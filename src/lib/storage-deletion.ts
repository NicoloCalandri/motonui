import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Drains public.storage_deletion_queue (migration 0022, T-2.9, SR-PRIV-04).
 *
 * purge_user_data() queues the storage objects of a deleted account: SQL can
 * only drop object metadata, the file itself is removed through the Storage
 * API. Called right after a web/admin deletion and by the daily cleanup cron
 * (deletions made from the mobile app). `admin` is the service-role client.
 */

const BATCH = 500;
const REMOVE_CHUNK = 100;

interface QueueRow {
    id: number;
    bucket_id: string;
    name: string;
}

export async function drainStorageDeletionQueue(admin: SupabaseClient, limit: number = BATCH): Promise<number> {
    const { data, error } = await admin
        .from('storage_deletion_queue')
        .select('id, bucket_id, name')
        .order('id', { ascending: true })
        .limit(limit);
    if (error) throw new Error(`[motonui][storage-deletion] read queue: ${error.message}`);

    const rows = (data ?? []) as QueueRow[];
    const byBucket = new Map<string, QueueRow[]>();
    for (const row of rows) byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row]);

    let removed = 0;
    for (const [bucket, bucketRows] of byBucket) {
        for (let i = 0; i < bucketRows.length; i += REMOVE_CHUNK) {
            const chunk = bucketRows.slice(i, i + REMOVE_CHUNK);
            const { error: removeError } = await admin.storage.from(bucket).remove(chunk.map((row) => row.name));
            if (removeError) {
                // Left in the queue: the next run retries.
                console.error('[motonui][storage-deletion] remove', bucket, removeError.message);
                continue;
            }
            const { error: dequeueError } = await admin
                .from('storage_deletion_queue')
                .delete()
                .in('id', chunk.map((row) => row.id));
            if (dequeueError) throw new Error(`[motonui][storage-deletion] dequeue: ${dequeueError.message}`);
            removed += chunk.length;
        }
    }
    return removed;
}
