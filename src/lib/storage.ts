import { createAdminClient } from '@/lib/supabase/server';

/** Allowed MIME types for upload */
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
]);

/** Max file size: 50 MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Supabase Storage bucket names */
export const Buckets = {
    tripMedia: 'trip-media',
    postCovers: 'post-covers',
    instagramExports: 'instagram-exports',
} as const;

export type BucketName = (typeof Buckets)[keyof typeof Buckets];

/**
 * Validates a file's MIME type and size before uploading.
 * Throws an error with a user-friendly message if invalid.
 */
export function validateFile(mimeType: string, size: number): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(
            `Tipo di file non supportato: ${mimeType}. Carica JPEG, PNG, WebP, HEIC o MP4.`
        );
    }
    if (size > MAX_FILE_SIZE) {
        throw new Error(
            `File troppo grande (${(size / 1024 / 1024).toFixed(1)} MB). Massimo consentito: 50 MB.`
        );
    }
}

/**
 * Uploads a file to a Supabase Storage bucket.
 *
 * @param bucket - Target bucket name
 * @param path - Full storage path (e.g., "trips/abc/original/photo.webp")
 * @param file - Buffer or ArrayBuffer to upload
 * @param contentType - MIME type of the file
 * @returns Public or signed URL of the uploaded file
 */
export async function uploadFile(
    bucket: BucketName,
    path: string,
    file: Buffer | ArrayBuffer,
    contentType: string
): Promise<string> {
    const supabase = await createAdminClient();

    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType, upsert: true });

    if (error) {
        throw new Error(`[motonui][storage][upload] ${error.message}`);
    }

    return getPublicUrl(bucket, path);
}

/**
 * Gets the public URL of a file in a public bucket.
 * For private buckets, use getSignedUrl instead.
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
    // We use the admin client's URL builder — no async needed
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Creates a signed URL for private bucket files.
 *
 * @param bucket - Source bucket name
 * @param path - File path within the bucket
 * @param expiresInSeconds - How long the URL is valid (default: 3600 = 1 hour)
 */
export async function getSignedUrl(
    bucket: BucketName,
    path: string,
    expiresInSeconds: number = 3600
): Promise<string> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
        throw new Error(`[motonui][storage][sign] ${error?.message ?? 'Could not sign URL'}`);
    }

    return data.signedUrl;
}

/**
 * Deletes a file from a Supabase Storage bucket.
 */
export async function deleteFile(bucket: BucketName, path: string): Promise<void> {
    const supabase = await createAdminClient();

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
        console.error(`[motonui][storage][delete] ${error.message}`);
    }
}

/**
 * Lists all files under a given prefix in a bucket.
 */
export async function listFiles(bucket: BucketName, prefix: string) {
    const supabase = await createAdminClient();

    const { data, error } = await supabase.storage.from(bucket).list(prefix);

    if (error) {
        throw new Error(`[motonui][storage][list] ${error.message}`);
    }

    return data ?? [];
}
