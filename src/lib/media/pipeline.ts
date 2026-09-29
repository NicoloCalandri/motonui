import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/errors';
import { Buckets, validateFile } from '@/lib/storage';
import { buildMediaPath, isTripFilePath } from '@/lib/trip-files';
import type { ImageMetadata } from '@/lib/types';

/**
 * Photo/video upload pipeline (T-2.2, SR-PRIV-01, FR-30–33).
 *
 * 1. `createUploadTarget` signs a one-off upload to `trips/{id}/incoming/…`:
 *    the browser uploads straight to storage (no 4.5 MB route body limit).
 * 2. `ingestUpload` checks the uploaded bytes, strips metadata by re-encoding
 *    images with sharp (`rotate()` applies the EXIF orientation first), writes
 *    `original/{uuid}.webp` and a 400×400 WebP thumbnail in `thumbs/`, and
 *    removes the incoming object. Videos are moved as they are.
 *
 * Server only: sharp and the service role never reach the browser.
 */

export const THUMB_SIZE = 400;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // trip-media file_size_limit (0020)

export const UPLOAD_EXTENSION_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
};

const MIME_BY_UPLOAD_EXTENSION: Record<string, string> = Object.fromEntries(
    Object.entries(UPLOAD_EXTENSION_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

export interface UploadTarget {
    path: string;
    token: string;
    signedUrl: string;
}

export interface IngestedMedia {
    storage_path: string;
    thumb_path: string | null;
    mime_type: string;
    size: number;
    width: number | null;
    height: number | null;
    metadata: ImageMetadata;
}

function invalid(message: string): AppError {
    return new AppError(message, 'VALIDATION_ERROR', 400);
}

export function incomingPath(tripId: string, mimeType: string): string {
    const extension = UPLOAD_EXTENSION_BY_MIME[mimeType];
    if (!extension) throw invalid('Tipo di file non supportato. Carica JPEG, PNG, WebP o MP4.');
    return `trips/${tripId}/incoming/${crypto.randomUUID()}.${extension}`;
}

/** Signs a one-off upload for the declared type and size. `admin` is the service-role client. */
export async function createUploadTarget(
    admin: SupabaseClient,
    tripId: string,
    declared: { mimeType: string; size: number },
): Promise<UploadTarget> {
    if (declared.size <= 0 || declared.size > MAX_UPLOAD_BYTES) {
        throw invalid(`File troppo grande. Massimo consentito: ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    }
    const path = incomingPath(tripId, declared.mimeType);

    const { data, error } = await admin.storage.from(Buckets.tripMedia).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`[motonui][media][upload-url] ${error?.message ?? 'no data'}`);
    return { path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Turns an uploaded incoming object into the stored original (+ thumbnail).
 * The incoming object is always removed, also when the file is rejected.
 */
export async function ingestUpload(admin: SupabaseClient, tripId: string, path: string): Promise<IngestedMedia> {
    if (!isTripFilePath(path, tripId, 'incoming')) throw invalid('Upload non valido.');
    const extension = path.split('.').pop() ?? '';
    const mimeType = MIME_BY_UPLOAD_EXTENSION[extension];
    if (!mimeType) throw invalid('Upload non valido.');

    const bucket = admin.storage.from(Buckets.tripMedia);
    const { data: blob, error } = await bucket.download(path);
    if (error || !blob) {
        throw new AppError('Non troviamo il file caricato. Riprova 🏝️', 'UPLOAD_NOT_FOUND', 404);
    }

    const written: string[] = [];
    try {
        const input = Buffer.from(await blob.arrayBuffer());
        validateFile(mimeType, input.byteLength, input);

        if (mimeType === 'video/mp4') {
            const storagePath = buildMediaPath(tripId, 'original', 'mp4');
            const { error: moveError } = await bucket.move(path, storagePath);
            if (moveError) throw new Error(`[motonui][media][ingest] move: ${moveError.message}`);
            return {
                storage_path: storagePath, thumb_path: null, mime_type: mimeType, size: input.byteLength,
                width: null, height: null, metadata: { orientation: 1 },
            };
        }

        const image = await processImage(input);
        const id = crypto.randomUUID();
        const storagePath = buildMediaPath(tripId, 'original', 'webp', id);
        const thumbPath = buildMediaPath(tripId, 'thumbs', 'webp', id);

        for (const [target, body] of [[storagePath, image.original], [thumbPath, image.thumbnail]] as const) {
            const { error: uploadError } = await bucket.upload(target, body, { contentType: 'image/webp', upsert: false });
            if (uploadError) throw new Error(`[motonui][media][ingest] upload: ${uploadError.message}`);
            written.push(target);
        }
        await bucket.remove([path]);

        return {
            storage_path: storagePath, thumb_path: thumbPath, mime_type: 'image/webp', size: image.original.byteLength,
            width: image.width, height: image.height, metadata: image.metadata,
        };
    } catch (err) {
        await bucket.remove([path, ...written]);
        throw err;
    }
}

export interface ProcessedImage {
    original: Buffer;
    thumbnail: Buffer;
    width: number;
    height: number;
    metadata: ImageMetadata;
}

/**
 * Re-encodes an image to WebP without any metadata (EXIF, GPS, XMP, ICC):
 * sharp drops metadata unless `withMetadata()` is called, and `rotate()`
 * bakes the EXIF orientation into the pixels first. The date, camera and
 * position are kept only as DB columns, readable by trip members.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
    const { default: sharp } = await import('sharp');
    const metadata = await extractExifMetadata(input);

    try {
        const { data: original, info } = await sharp(input, { failOn: 'error' })
            .rotate()
            .webp({ quality: 90 })
            .toBuffer({ resolveWithObject: true });

        const thumbnail = await sharp(input, { failOn: 'error' })
            .rotate()
            .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'attention' })
            .webp({ quality: 80 })
            .toBuffer();

        return { original, thumbnail, width: info.width, height: info.height, metadata };
    } catch (err) {
        console.warn('[motonui][media][process] sharp failed:', err);
        throw invalid('Non riusciamo a leggere questa immagine. Le foto HEIC vanno esportate in JPEG 🏝️');
    }
}

async function extractExifMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
        const exifr = await import('exifr');
        const exif = await exifr.parse(buffer, {
            gps: true,
            // The Ref tags carry the hemisphere: without them S/W come out positive.
            pick: [
                'DateTimeOriginal', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef',
                'Make', 'Model', 'Orientation',
            ],
        });
        if (!exif) return { orientation: 1 };

        return {
            dateTaken: exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : undefined,
            gps:
                typeof exif.latitude === 'number' && typeof exif.longitude === 'number'
                    ? { lat: exif.latitude, lng: exif.longitude }
                    : undefined,
            camera: exif.Make && exif.Model ? `${String(exif.Make)} ${String(exif.Model)}`.trim() : undefined,
            orientation: typeof exif.Orientation === 'number' ? exif.Orientation : 1,
        };
    } catch {
        return { orientation: 1 };
    }
}

/**
 * Removes incoming uploads never confirmed, older than `maxAgeMs`. Used by the
 * daily cleanup cron. `admin` is the service-role client.
 */
export async function removeStaleIncomingUploads(
    admin: SupabaseClient,
    now: number = Date.now(),
    maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<number> {
    const bucket = admin.storage.from(Buckets.tripMedia);
    const { data: trips, error } = await bucket.list('trips', { limit: 1000 });
    if (error) throw new Error(`[motonui][cleanup][incoming] list: ${error.message}`);

    let removed = 0;
    for (const trip of trips ?? []) {
        if (trip.id !== null) continue; // only folders
        const prefix = `trips/${trip.name}/incoming`;
        const { data: files, error: listError } = await bucket.list(prefix, { limit: 1000 });
        if (listError) throw new Error(`[motonui][cleanup][incoming] list ${prefix}: ${listError.message}`);

        const stale = (files ?? [])
            .filter((file) => file.id !== null && (!file.created_at || new Date(file.created_at).getTime() < now - maxAgeMs))
            .map((file) => `${prefix}/${file.name}`);
        if (stale.length === 0) continue;

        const { error: removeError } = await bucket.remove(stale);
        if (removeError) throw new Error(`[motonui][cleanup][incoming] remove: ${removeError.message}`);
        removed += stale.length;
    }
    return removed;
}
