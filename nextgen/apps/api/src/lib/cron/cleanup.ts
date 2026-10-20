import { removeExpiredExportObjects } from '../instagram-cleanup';
import { log } from '../log';
import { removeStaleIncomingUploads } from '../media/pipeline';
import { drainStorageDeletionQueue } from '../storage-deletion';
import { createAdminClient } from '../supabase/server';

/**
 * Daily cleanup. Port of the handler body of
 * src/app/api/admin/cleanup/route.ts, as a plain function so that both the
 * HTTP route (routes/admin/cleanup.ts) and the in-process scheduler
 * (src/scheduler.ts) can call it.
 */
export async function runCleanup(): Promise<{ success: true; results: Record<string, number> }> {
    const supabase = createAdminClient();
    const results: Record<string, number> = {};

    // Expired Instagram exports: objects first, then rows (any status)
    results.removedExportObjects = await removeExpiredExportObjects(supabase);

    const { count: exportCount } = await supabase
        .from('instagram_exports')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString());

    results.expiredExports = exportCount ?? 0;

    // Uploads signed but never confirmed: raw files, EXIF included
    results.staleIncomingUploads = await removeStaleIncomingUploads(supabase);

    // Files of deleted accounts and trips, queued by purge_user_data()
    results.deletedAccountFiles = await drainStorageDeletionQueue(supabase);

    // Rate limit windows older than a day
    const { data: prunedRateLimits } = await supabase.rpc('prune_rate_limits');
    results.prunedRateLimits = prunedRateLimits ?? 0;

    // AI usage older than 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count: aiUsageCount } = await supabase
        .from('ai_usage')
        .delete({ count: 'exact' })
        .lt('date', ninetyDaysAgo);

    results.prunedAiUsage = aiUsageCount ?? 0;

    // Destination cache older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: destCacheCount } = await supabase
        .from('destination_cache')
        .delete({ count: 'exact' })
        .lt('fetched_at', thirtyDaysAgo);

    results.prunedDestinationCache = destCacheCount ?? 0;

    log.info('[motonui][admin][cleanup]', results);
    return { success: true, results };
}
