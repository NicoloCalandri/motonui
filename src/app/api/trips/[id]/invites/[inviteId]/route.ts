import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';

/** DELETE /api/trips/[id]/invites/[inviteId] — the owner revokes a pending invite */
export const DELETE = withRoute(
    { name: 'trips/[id]/invites/[inviteId] DELETE', params: tripParams('inviteId'), tripMember: true },
    async ({ supabase, params }) => {
        // RLS: only the trip owner, only while the invite is pending.
        const { data, error } = await supabase
            .from('trip_invites')
            .delete()
            .eq('id', params.inviteId)
            .eq('trip_id', params.id)
            .select('id')
            .maybeSingle();

        if (error || !data) throw Errors.notFound('Invito');
        return ok({ success: true });
    },
);
