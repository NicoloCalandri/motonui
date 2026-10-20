import { Hono } from 'hono';
import { z } from 'zod';
import { withErrorHandler, ok, created, requireParam, readJsonObject, issueSummary } from '../lib/http';
import { Errors } from '../lib/errors';
import { sendEmail, tripInviteEmail } from '../lib/email';
import { generateInviteToken, hashInviteToken, inviteErrorToAppError, inviteUrl } from '../lib/invites';
import { log } from '../lib/log';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/invites. Membership is checked by tripGuard (app.ts).
// Port of src/app/api/trips/[id]/invites/**.
export const tripsInvitesRouter = new Hono<AppEnv>();

const CreateInviteSchema = z.object({
    email: z.string().trim().toLowerCase().email('indirizzo email non valido').max(320),
});

/** GET /api/trips/:id/invites — the trip's invites (pending ones first) */
tripsInvitesRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const { data, error } = await c.get('supabase')
            .from('trip_invites')
            .select('id, email, created_at, expires_at, accepted_at')
            .eq('trip_id', requireParam(c, 'id'))
            .order('created_at', { ascending: false });

        if (error) throw new Error(`[motonui][invites][GET] ${error.message}`);
        return ok(c, data ?? []);
    }, 'trips/:id/invites GET')
);

/**
 * POST /api/trips/:id/invites — the owner invites the partner.
 * The RPC checks ownership and the two-member limit and replaces any pending
 * invite. The response carries the link so it can also be shared by hand.
 */
tripsInvitesRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = c.get('user');
        const id = requireParam(c, 'id');

        const parsed = CreateInviteSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));
        const body = parsed.data;

        if (body.email === user.email?.toLowerCase()) {
            throw Errors.validation('non puoi invitare te stesso.');
        }

        const token = generateInviteToken();
        const { data: invite, error } = await supabase.rpc('create_trip_invite', {
            p_trip_id: id,
            p_email: body.email,
            p_token_hash: hashInviteToken(token),
        });

        if (error || !invite) {
            throw inviteErrorToAppError(error?.message) ?? new Error(`[motonui][invites][POST] ${error?.message}`);
        }

        const url = inviteUrl(token);
        const { data: trip } = await supabase.from('trips').select('title, destination').eq('id', id).single();

        let emailSent = true;
        try {
            await sendEmail({
                to: invite.email,
                subject: `🏝️ Ti hanno invitato a un viaggio su motonui`,
                html: tripInviteEmail({
                    inviterName: user.email?.split('@')[0] ?? 'Il tuo partner',
                    tripTitle: trip?.title ?? 'un viaggio',
                    destination: trip?.destination ?? '',
                    inviteUrl: url,
                }),
            });
        } catch (err) {
            // The invite exists anyway: the owner can share the link by hand.
            log.error('[motonui][invites][POST] email failed', err);
            emailSent = false;
        }

        return created(c, {
            invite: { id: invite.id, email: invite.email, expires_at: invite.expires_at },
            invite_url: url,
            email_sent: emailSent && Boolean(process.env.RESEND_API_KEY),
        });
    }, 'trips/:id/invites POST')
);

/** DELETE /api/trips/:id/invites/:inviteId — the owner revokes a pending invite */
tripsInvitesRouter.delete(
    '/:inviteId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const id = requireParam(c, 'id');
        const inviteId = requireParam(c, 'inviteId');

        // RLS: only the trip owner, only while the invite is pending.
        const { data, error } = await c.get('supabase')
            .from('trip_invites')
            .delete()
            .eq('id', inviteId)
            .eq('trip_id', id)
            .select('id')
            .maybeSingle();

        if (error || !data) throw Errors.notFound('Invito');
        return ok(c, { success: true });
    }, 'trips/:id/invites/:inviteId DELETE')
);
