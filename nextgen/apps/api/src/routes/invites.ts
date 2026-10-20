import { Hono } from 'hono';
import { z } from 'zod';
import { withErrorHandler, ok, readJsonObject, issueSummary } from '../lib/http';
import { Errors } from '../lib/errors';
import { INVITE_TOKEN_PATTERN, inviteErrorToAppError } from '../lib/invites';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/invites. Port of src/app/api/invites/accept/route.ts.
export const invitesRouter = new Hono<AppEnv>();

const AcceptSchema = z.object({
    token: z.string().regex(INVITE_TOKEN_PATTERN, 'invito non valido'),
});

/**
 * POST /api/invites/accept — the invited partner joins the trip.
 * accept_trip_invite() checks the token hash, expiry, single use, the invited
 * email and the two-member limit in one transaction.
 */
invitesRouter.post(
    '/accept',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const parsed = AcceptSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

        const { data: tripId, error } = await c.get('supabase').rpc('accept_trip_invite', { p_token: parsed.data.token });

        if (error || !tripId) {
            throw inviteErrorToAppError(error?.message) ?? new Error(`[motonui][invites][accept] ${error?.message}`);
        }
        return ok(c, { trip_id: tripId });
    }, 'invites/accept POST')
);
