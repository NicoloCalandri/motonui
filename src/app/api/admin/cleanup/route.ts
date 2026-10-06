import { createAdminClient } from '@/lib/supabase/server';
import { isAuthorizedCronRequest } from '@/lib/auth/cron';
import { Errors, ok, withErrorHandler } from '@/lib/errors';
import { removeExpiredExportObjects } from '@/lib/instagram-cleanup';
import { removeStaleIncomingUploads } from '@/lib/media/pipeline';
import { drainStorageDeletionQueue } from '@/lib/storage-deletion';

/**
 * GET /api/admin/cleanup — daily cleanup, called by Vercel Cron (vercel.json)
 * with `Authorization: Bearer ${CRON_SECRET}` (T-2.6).
 *
 * Tasks:
 * - Delete Instagram ZIP objects older than 24 h, then the expired rows
 * - Prune ai_usage records older than 90 days
 * - Prune destination cache older than 30 days
 * - Prune rate limit windows older than a day
 */
export const GET = withErrorHandler(async (request) => {
    if (!isAuthorizedCronRequest(request)) throw Errors.unauthorized();

    const supabase = await createAdminClient();
    const results: Record<string, number> = {};

    // 1. Expired Instagram exports: objects first, then rows (any status)
    results.removedExportObjects = await removeExpiredExportObjects(supabase);

    const { count: exportCount } = await supabase
        .from('instagram_exports')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString());

    results.expiredExports = exportCount ?? 0;

    // 2. Uploads signed but never confirmed (T-2.2): raw files, EXIF included
    results.staleIncomingUploads = await removeStaleIncomingUploads(supabase);

    // 3. Files of deleted accounts (T-2.9): queued by purge_user_data(), e.g.
    //    after a deletion from the mobile app, which has no server step
    results.deletedAccountFiles = await drainStorageDeletionQueue(supabase);

    // 4. Rate limit windows older than a day (T-4.5)
    const { data: prunedRateLimits } = await supabase.rpc('prune_rate_limits');
    results.prunedRateLimits = prunedRateLimits ?? 0;

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
}, 'admin/cleanup GET');
