import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

const ADMIN_SECRET = process.env.ADMIN_CLEANUP_SECRET;

/**
 * POST /api/admin/cleanup — runs scheduled cleanup tasks.
 * Protected by a static secret header; intended to be called from a cron job.
 *
 * Tasks:
 * - Delete expired instagram_exports (older than expiry and status = 'ready')
 * - Prune ai_usage records older than 90 days
 * - Remove orphaned media records (media without a trip)
 */
export async function POST(request: Request): Promise<Response> {
    // Verify secret
    const authHeader = request.headers.get('x-admin-secret');
    if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createAdminClient();
    const results: Record<string, number> = {};

    // 1. Delete expired Instagram exports
    const { count: exportCount } = await supabase
        .from('instagram_exports')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'ready');

    results.expiredExports = exportCount ?? 0;

    // 2. Prune AI usage older than 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count: aiUsageCount } = await supabase
        .from('ai_usage')
        .delete({ count: 'exact' })
        .lt('date', ninetyDaysAgo);

    results.prunedAiUsage = aiUsageCount ?? 0;

    // 3. Prune stale destination cache (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: destCacheCount } = await supabase
        .from('destination_cache')
        .delete({ count: 'exact' })
        .lt('fetched_at', thirtyDaysAgo);

    results.prunedDestinationCache = destCacheCount ?? 0;

    console.info('[motonui][admin][cleanup]', results);
    return ok({ success: true, results });
}
