import { z } from 'zod';
import { Errors, ok, created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { sendEmail, tripInviteEmail } from '@/lib/email';
import { generateInviteToken, hashInviteToken, inviteErrorToAppError, inviteUrl } from '@/lib/invites';
import { log } from '@/lib/log';

const CreateInviteSchema = z.object({
    email: z.string().trim().toLowerCase().email('indirizzo email non valido').max(320),
});

/** GET /api/trips/[id]/invites — the trip's invites (pending ones first) */
export const GET = withRoute(
    { name: 'trips/[id]/invites GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
        const { data, error } = await supabase
            .from('trip_invites')
            .select('id, email, created_at, expires_at, accepted_at')
            .eq('trip_id', params.id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`[motonui][invites][GET] ${error.message}`);
        return ok(data ?? []);
    },
);

/**
 * POST /api/trips/[id]/invites — the owner invites the partner (T-2.5).
 * The RPC checks ownership and the two-member limit and replaces any pending
 * invite. The response carries the link so it can also be shared by hand.
 */
export const POST = withRoute(
    { name: 'trips/[id]/invites POST', params: tripParams(), body: CreateInviteSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
        if (body.email === user.email?.toLowerCase()) {
            throw Errors.validation('non puoi invitare te stesso.');
        }

        const token = generateInviteToken();
        const { data: invite, error } = await supabase.rpc('create_trip_invite', {
            p_trip_id: params.id,
            p_email: body.email,
            p_token_hash: hashInviteToken(token),
        });

        if (error || !invite) {
            throw inviteErrorToAppError(error?.message) ?? new Error(`[motonui][invites][POST] ${error?.message}`);
        }

        const url = inviteUrl(token);
        const { data: trip } = await supabase.from('trips').select('title, destination').eq('id', params.id).single();

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

        return created({
            invite: { id: invite.id, email: invite.email, expires_at: invite.expires_at },
            invite_url: url,
            email_sent: emailSent && Boolean(process.env.RESEND_API_KEY),
        });
    },
);
