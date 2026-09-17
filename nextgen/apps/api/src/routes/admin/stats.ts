import { Hono } from 'hono';
import type { PlatformStats } from '@motonui/shared-types';
import { createAdminClient } from '../../lib/supabase/server';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import type { AppEnv } from '../../types';

export const statsRouter = new Hono<AppEnv>();

/** GET /api/admin/stats — aggregate platform statistics (cached 5 min) */
statsRouter.get('/', requireUser, loadProfile, requireAdmin, async (c) => {
    const supabase = createAdminClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [usersRes, activeUsersRes, tripsRes, expensesRes, postsRes, aiCallsRes] = await Promise.all([
        (supabase as any).from('profiles').select('id', { count: 'exact', head: true }),
        supabase.auth.admin.listUsers(),
        (supabase.from('trips') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('expenses') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('posts') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('ai_usage') as any).select('id', { count: 'exact', head: true }),
    ]);

    const activeUsersLast30Days = (activeUsersRes.data?.users ?? []).filter(
        (u: any) => u.last_sign_in_at && u.last_sign_in_at >= thirtyDaysAgo
    ).length;

    const stats: PlatformStats = {
        totalUsers: usersRes.count ?? 0,
        activeUsersLast30Days,
        totalTrips: tripsRes.count ?? 0,
        totalExpenses: expensesRes.count ?? 0,
        totalPosts: postsRes.count ?? 0,
        totalAiCalls: aiCallsRes.count ?? 0,
    };

    c.header('Cache-Control', 'private, max-age=300');
    return c.json(stats);
});
