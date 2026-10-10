import { z } from 'zod';
import { ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { INVITE_TOKEN_PATTERN, inviteErrorToAppError } from '@/lib/invites';

const AcceptSchema = z.object({
    token: z.string().regex(INVITE_TOKEN_PATTERN, 'invito non valido'),
});

/**
 * POST /api/invites/accept — the invited partner joins the trip (T-2.5).
 * accept_trip_invite() checks the token hash, expiry, single use, the invited
 * email and the two-member limit in one transaction.
 */
export const POST = withRoute(
    { name: 'invites/accept POST', body: AcceptSchema },
    async ({ supabase, body }) => {
        const { data: tripId, error } = await supabase.rpc('accept_trip_invite', { p_token: body.token });

        if (error || !tripId) {
            throw inviteErrorToAppError(error?.message) ?? new Error(`[motonui][invites][accept] ${error?.message}`);
        }
        return ok({ trip_id: tripId });
    },
);
