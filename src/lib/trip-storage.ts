import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { Buckets } from '@/lib/storage';
import { isBoardingPassPathForTrip, legacyBoardingPassPath } from '@/lib/boarding-pass';
import { isTripFilePath, tripStoragePrefix } from '@/lib/trip-files';
import type { Media, MediaWithUrls } from '@/lib/types';

/** Signed media URLs last one hour (T-2.1). */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

const LIST_PAGE = 1000;
const MAX_DEPTH = 3;

type StorageBucketApi = ReturnType<SupabaseClient['storage']['from']>;

/**
 * Adds signed URLs to media rows. Signs with the caller's client, so the
 * storage policy (trip members only) applies on top of the route's own
 * membership check. Paths outside the trip are never signed.
 */
export async function withSignedUrls(
    supabase: SupabaseClient,
    tripId: string,
    rows: Media[],
): Promise<MediaWithUrls[]> {
    const paths = [
        ...new Set(
            rows.flatMap((row) => [row.storage_path, row.thumb_path]).filter((path): path is string => isTripFilePath(path, tripId)),
        ),
    ];

    const signed = new Map<string, string>();
    if (paths.length > 0) {
        const { data, error } = await supabase.storage
            .from(Buckets.tripMedia)
            .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
        if (error) {
            console.error('[motonui][storage][sign] media', error.message);
        }
        for (const entry of data ?? []) {
            if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl);
        }
    }

    return rows.map((row) => ({
        ...row,
        signed_url: (row.storage_path && signed.get(row.storage_path)) || null,
        signed_thumb_url: (row.thumb_path && signed.get(row.thumb_path)) || null,
    }));
}

/** Removes the stored files of a media row (service role, paths re-checked). */
export async function removeMediaFiles(
    tripId: string,
    media: Pick<Media, 'storage_path' | 'thumb_path'>,
): Promise<void> {
    const paths = [media.storage_path, media.thumb_path].filter((path): path is string => isTripFilePath(path, tripId));
    if (paths.length === 0) return;

    const admin = await createAdminClient();
    const { error } = await admin.storage.from(Buckets.tripMedia).remove(paths);
    if (error) console.error('[motonui][storage][delete] media', error.message);
}

/** Removes a document's uploaded file, if any. */
export async function removeDocumentFile(tripId: string, filePath: string | null): Promise<void> {
    if (!isTripFilePath(filePath, tripId, 'documents')) return;
    const admin = await createAdminClient();
    const { error } = await admin.storage.from(Buckets.tripDocuments).remove([filePath]);
    if (error) console.error('[motonui][storage][delete] document', error.message);
}

/** Removes a leg's boarding pass, private or legacy public copy (T-2.3). */
export async function removeLegFiles(
    tripId: string,
    leg: { boarding_pass_path?: string | null; boarding_pass_url?: string | null },
): Promise<void> {
    const admin = await createAdminClient();

    if (isBoardingPassPathForTrip(leg.boarding_pass_path, tripId)) {
        const { error } = await admin.storage.from(Buckets.tripDocuments).remove([leg.boarding_pass_path]);
        if (error) console.error('[motonui][storage][delete] boarding pass', error.message);
    }

    const legacyPath = legacyBoardingPassPath(leg.boarding_pass_url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (isBoardingPassPathForTrip(legacyPath, tripId)) {
        const { error } = await admin.storage.from(Buckets.tripMedia).remove([legacyPath]);
        if (error) console.error('[motonui][storage][delete] legacy boarding pass', error.message);
    }
}

/**
 * Deletes every stored file of a trip: media, documents, boarding passes and
 * Instagram ZIPs. Call it after the caller is authorized to delete the trip.
 * Returns the number of objects removed.
 */
export async function removeTripFiles(tripId: string): Promise<number> {
    const admin = await createAdminClient();
    const targets: Array<{ bucket: StorageBucketApi; prefix: string }> = [
        { bucket: admin.storage.from(Buckets.tripMedia), prefix: tripStoragePrefix(tripId).slice(0, -1) },
        { bucket: admin.storage.from(Buckets.tripDocuments), prefix: tripStoragePrefix(tripId).slice(0, -1) },
        { bucket: admin.storage.from(Buckets.instagramExports), prefix: tripId },
    ];

    let removed = 0;
    for (const { bucket, prefix } of targets) {
        const paths = await listFilesRecursive(bucket, prefix, MAX_DEPTH);
        for (let i = 0; i < paths.length; i += LIST_PAGE) {
            const chunk = paths.slice(i, i + LIST_PAGE);
            const { error } = await bucket.remove(chunk);
            if (error) throw new Error(`[motonui][storage][delete] trip files: ${error.message}`);
            removed += chunk.length;
        }
    }
    return removed;
}

async function listFilesRecursive(bucket: StorageBucketApi, prefix: string, depth: number): Promise<string[]> {
    const files: string[] = [];
    for (let offset = 0; ; offset += LIST_PAGE) {
        const { data, error } = await bucket.list(prefix, { limit: LIST_PAGE, offset });
        if (error) throw new Error(`[motonui][storage][list] ${prefix}: ${error.message}`);
        const entries = data ?? [];

        for (const entry of entries) {
            const path = `${prefix}/${entry.name}`;
            if (entry.id !== null) files.push(path);
            else if (depth > 0) files.push(...(await listFilesRecursive(bucket, path, depth - 1)));
        }
        if (entries.length < LIST_PAGE) return files;
    }
}
