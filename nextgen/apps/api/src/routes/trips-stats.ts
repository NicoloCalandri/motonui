import { Hono } from 'hono';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, requireParam } from '../lib/http';
import { getTripStats } from '../lib/trips';
import { requireTripMember } from '../lib/authz';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/stats
export const tripsStatsRouter = new Hono<AppEnv>();

/** GET /api/trips/:id/stats — return aggregated trip statistics */
tripsStatsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        // getTripStats() uses the admin client internally (there's no
        // implicit per-request RLS-scoped client in this architecture, see
        // lib/trips.ts), unlike the old Next.js version which relied on RLS
        // via a cookie-bound client. This explicit check restores the same
        // access boundary the original had — without it, any authenticated
        // user could read any trip's stats by guessing its id.
        await requireTripMember(supabase, id, user.id);

        const stats = await getTripStats(id);

        return ok(c, stats);
    }, 'trips/:id/stats GET')
);
