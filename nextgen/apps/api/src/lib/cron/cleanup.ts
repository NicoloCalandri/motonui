import { createAdminClient } from '../supabase/server';

/**
 * Direct port of the logic in the old src/app/api/admin/cleanup/route.ts,
 * extracted into a plain callable function so it can be invoked both by the
 * HTTP route (routes/admin/cleanup.ts, kept for manual/secret-header
 * triggering) and by the in-process scheduler (src/scheduler.ts).
 *
 * Tasks:
 * - Delete expired instagram_exports (older than expiry and status = 'ready')
 * - Prune ai_usage records older than 90 days
 * - Remove stale destination cache (older than 30 days)
 */
export async function runCleanup() {
    const supabase = createAdminClient();
    const results: Record<string, number> = {};

    const { count: exportCount } = await (supabase.from('instagram_exports') as any)
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'ready');

    results.expiredExports = exportCount ?? 0;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count: aiUsageCount } = await (supabase.from('ai_usage') as any)
        .delete({ count: 'exact' })
        .lt('date', ninetyDaysAgo);

    results.prunedAiUsage = aiUsageCount ?? 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: destCacheCount } = await (supabase.from('destination_cache') as any)
        .delete({ count: 'exact' })
        .lt('fetched_at', thirtyDaysAgo);

    results.prunedDestinationCache = destCacheCount ?? 0;

    console.info('[motonui][admin][cleanup]', results);
    return { success: true, results };
}
