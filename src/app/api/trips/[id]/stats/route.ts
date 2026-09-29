import { ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { getTripStats } from '@/lib/trips';

/** GET /api/trips/[id]/stats — return aggregated trip statistics */
export const GET = withRoute(
    { name: 'trips/[id]/stats GET', params: tripParams(), tripMember: true },
    async ({ params }) => {
    const { id } = params;
    const stats = await getTripStats(id);

    return ok(stats);
});
