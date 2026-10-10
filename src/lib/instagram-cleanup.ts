import type { SupabaseClient } from '@supabase/supabase-js';
import { Buckets } from '@/lib/storage';

/** Instagram ZIPs live 24 h (CLAUDE.md, SR-PRIV-06). */
export const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 1000;

/**
 * Removes every ZIP older than EXPORT_TTL_MS from the instagram-exports
 * bucket (`{trip_id}/{export_id}.zip`), including orphans whose row is gone,
 * and returns how many objects were deleted. Uses the service-role client.
 */
export async function removeExpiredExportObjects(supabase: SupabaseClient, now: number = Date.now()): Promise<number> {
    const bucket = supabase.storage.from(Buckets.instagramExports);
    const cutoff = now - EXPORT_TTL_MS;

    const { data: folders, error } = await bucket.list('', { limit: LIST_LIMIT });
    if (error) throw new Error(`[motonui][cleanup][instagram] list: ${error.message}`);

    let removed = 0;
    // Folders come back without an id; files at the root (legacy) with one.
    for (const folder of folders ?? []) {
        const isFile = folder.id !== null;
        const entries = isFile
            ? [{ path: folder.name, createdAt: folder.created_at }]
            : await listFolder(bucket, folder.name);

        const expired = entries
            .filter((entry) => !entry.createdAt || new Date(entry.createdAt).getTime() < cutoff)
            .map((entry) => entry.path);
        if (expired.length === 0) continue;

        const { error: removeError } = await bucket.remove(expired);
        if (removeError) throw new Error(`[motonui][cleanup][instagram] remove: ${removeError.message}`);
        removed += expired.length;
    }
    return removed;
}

async function listFolder(
    bucket: ReturnType<SupabaseClient['storage']['from']>,
    folder: string,
): Promise<{ path: string; createdAt: string | null }[]> {
    const { data, error } = await bucket.list(folder, { limit: LIST_LIMIT });
    if (error) throw new Error(`[motonui][cleanup][instagram] list ${folder}: ${error.message}`);
    return (data ?? [])
        .filter((entry) => entry.id !== null)
        .map((entry) => ({ path: `${folder}/${entry.name}`, createdAt: entry.created_at ?? null }));
}
