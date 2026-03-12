import { validateFile, uploadFile, Buckets } from '@/lib/storage';
import type { UploadResult, ImageMetadata } from '@/lib/types';

/**
 * Upload pipeline for trip photos and videos.
 * Steps: validate → extract EXIF → generate thumbnail → convert to WebP → upload both to storage.
 *
 * @param file - Browser File object received from multipart form
 * @param tripId - UUID of the trip this media belongs to
 */
export async function uploadMedia(file: File, tripId: string): Promise<UploadResult> {
    // 1. Validate MIME type and size
    validateFile(file.type, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());

    // 2. Extract EXIF metadata (images only)
    const metadata = await extractExifMetadata(buffer, file.type);

    // 3. Get image dimensions and generate thumbnail via sharp (server-side only)
    const { sharp } = await importSharp();

    let originalBuffer = buffer;
    let width = 0;
    let height = 0;
    let thumbnailUrl = '';
    const fileId = crypto.randomUUID();

    if (file.type.startsWith('image/')) {
        // Rotate according to EXIF orientation
        const img = sharp(buffer).rotate();

        const imgMeta = await img.metadata();
        width = imgMeta.width ?? 0;
        height = imgMeta.height ?? 0;

        // Convert to WebP for storage efficiency
        originalBuffer = await img.webp({ quality: 90 }).toBuffer();

        // Thumbnail: 400×400 cover crop
        const thumbBuffer = await sharp(buffer)
            .rotate()
            .resize(400, 400, { fit: 'cover', position: 'attention' })
            .webp({ quality: 80 })
            .toBuffer();

        // Upload thumbnail
        const thumbPath = `trips/${tripId}/thumbs/${fileId}.webp`;
        thumbnailUrl = await uploadFile(Buckets.tripMedia, thumbPath, thumbBuffer, 'image/webp');
    }

    // 4. Upload original (or video as-is)
    const ext = file.type.startsWith('image/') ? 'webp' : 'mp4';
    const originalPath = `trips/${tripId}/original/${fileId}.${ext}`;
    const mimeType = file.type.startsWith('image/') ? 'image/webp' : file.type;
    const url = await uploadFile(Buckets.tripMedia, originalPath, originalBuffer, mimeType);

    return {
        id: fileId,
        url,
        thumbnailUrl: thumbnailUrl || url,
        width,
        height,
        size: originalBuffer.byteLength,
        mimeType,
        metadata,
    };
}

// ─── EXIF Extraction ─────────────────────────────────────────────────────────

/**
 * Extracts GPS, date taken, camera model, and orientation from EXIF data.
 * Gracefully returns defaults if extraction fails.
 */
async function extractExifMetadata(buffer: Buffer, mimeType: string): Promise<ImageMetadata> {
    if (!mimeType.startsWith('image/')) {
        return { orientation: 1 };
    }

    try {
        const exifr = await import('exifr');
        const exif = await exifr.parse(buffer, {
            gps: true,
            pick: ['DateTimeOriginal', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model', 'Orientation'],
        });

        if (!exif) return { orientation: 1 };

        return {
            dateTaken: exif.DateTimeOriginal?.toISOString(),
            gps:
                exif.latitude !== undefined && exif.longitude !== undefined
                    ? { lat: exif.latitude as number, lng: exif.longitude as number }
                    : undefined,
            camera:
                exif.Make && exif.Model
                    ? `${exif.Make as string} ${exif.Model as string}`.trim()
                    : undefined,
            orientation: (exif.Orientation as number) ?? 1,
        };
    } catch (err) {
        console.warn('[motonui][upload][exif] Could not extract EXIF:', err);
        return { orientation: 1 };
    }
}

// ─── Sharp lazy import (server-only) ─────────────────────────────────────────

async function importSharp() {
    // Dynamic import prevents sharp from being bundled for the browser
    const sharp = (await import('sharp')).default;
    return { sharp };
}
