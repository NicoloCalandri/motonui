import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';
import type { PlatformStats } from '@/lib/types';

/** GET /api/admin/stats — aggregate platform statistics (cached 5 min) */
export async function GET() {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const supabase = await createAdminClient();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
        usersRes,
        activeUsersRes,
        tripsRes,
        expensesRes,
        postsRes,
        aiCallsRes,
    ] = await Promise.all([
        (supabase.from('profiles') as any).select('id', { count: 'exact', head: true }),
        supabase.auth.admin.listUsers(),
        (supabase.from('trips') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('expenses') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('posts') as any).select('id', { count: 'exact', head: true }),
        (supabase.from('ai_usage') as any).select('id', { count: 'exact', head: true }),
    ]);

    // Count users active in last 30 days
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

    return new Response(JSON.stringify(stats), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=300',
        },
    });
}
