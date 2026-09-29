import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImageFilter, TextOverlayOptions } from '@/lib/types';
import { applyFilter, cropToAspect, overlayText } from '@/lib/media/process';
import { buildSlides, INSTAGRAM_FORMATS, type InstagramFormat, type SlideSource } from '@/lib/media/instagram-slides';
import { AppError } from '@/lib/errors';
import { Buckets } from '@/lib/storage';
import { isTripFilePath } from '@/lib/trip-files';

/**
 * Instagram export job (T-2.7): runs after the API has answered 202, with the
 * service-role client, for an export row the route already authorized.
 * 1. load the selected media of the trip, in the user's order (buildSlides)
 * 2. read each photo from the private bucket (path re-checked, no URL fetch)
 * 3. crop to the format, filter, optional text overlay
 * 4. ZIP into the private instagram-exports bucket: {trip_id}/{export_id}.zip
 * 5. optionally write an AI caption
 */

export interface GenerateExportInput {
    admin: SupabaseClient;
    exportId: string;
    tripId: string;
    mediaIds: string[];
    format: InstagramFormat;
    filter: ImageFilter;
    textOverlay?: TextOverlayOptions;
    generateCaption: boolean;
    language: 'it' | 'en';
}

export interface CaptionResult {
    caption: string;
    hashtags: string[];
}

export interface GenerateExportOutput {
    zipPath: string;
    slideCount: number;
    captionResult?: CaptionResult;
}

export function exportZipPath(tripId: string, exportId: string): string {
    return `${tripId}/${exportId}.zip`;
}

export async function generateExport(input: GenerateExportInput): Promise<GenerateExportOutput> {
    const { admin, exportId, tripId, mediaIds, format, filter, textOverlay, generateCaption, language } = input;

    const { data: rows, error } = await admin
        .from('media')
        .select('id, trip_id, mime_type, storage_path, caption')
        .eq('trip_id', tripId)
        .in('id', mediaIds);
    if (error) throw new Error(`[motonui][instagram-export] media: ${error.message}`);

    const byId = new Map((rows ?? []).map((row) => [row.id as string, row]));
    const ordered = mediaIds.flatMap((id) => (byId.has(id) ? [byId.get(id) as SlideSource & { caption: string | null }] : []));
    const plan = buildSlides(ordered, format);

    if (plan.slides.length === 0) {
        throw new AppError(
            'Nessuna foto esportabile: scegli foto caricate su motonui (i video non sono supportati) 🏝️',
            'MEDIA_NOT_EXPORTABLE',
            400,
        );
    }

    const bucket = admin.storage.from(Buckets.tripMedia);
    const files: Array<{ name: string; data: Buffer }> = [];
    for (const slide of plan.slides) {
        // The path comes from the DB: re-check it belongs to this trip (T-2.4).
        if (!isTripFilePath(slide.storagePath, tripId)) {
            throw new AppError('Alcune foto selezionate non si possono esportare.', 'MEDIA_NOT_EXPORTABLE', 400);
        }
        const { data: blob, error: downloadError } = await bucket.download(slide.storagePath);
        if (downloadError || !blob) throw new Error(`[motonui][instagram-export] download ${slide.mediaId}`);

        let image = await cropToAspect(Buffer.from(await blob.arrayBuffer()), INSTAGRAM_FORMATS[format].ratio);
        if (filter !== 'none') image = await applyFilter(image, filter);
        if (textOverlay?.text) image = await overlayText(image, textOverlay);
        files.push({ name: slide.fileName, data: image });
    }

    const zipPath = exportZipPath(tripId, exportId);
    const { error: uploadError } = await admin.storage
        .from(Buckets.instagramExports)
        .upload(zipPath, await bundleAsZip(files, format), { contentType: 'application/zip', upsert: true });
    if (uploadError) throw new Error(`[motonui][instagram-export] upload: ${uploadError.message}`);

    let captionResult: CaptionResult | undefined;
    if (generateCaption) {
        try {
            const { generateCaption: genCap } = await import('@/lib/media/captions');
            const captions = plan.slides
                .map((slide) => byId.get(slide.mediaId)?.caption as string | null | undefined)
                .filter((caption): caption is string => Boolean(caption));
            captionResult = await genCap({ captions, type: format, language });
        } catch (err) {
            console.warn('[motonui][instagram-export] Caption generation failed:', err);
        }
    }

    return { zipPath, slideCount: plan.slides.length, captionResult };
}

async function bundleAsZip(files: Array<{ name: string; data: Buffer }>, format: InstagramFormat): Promise<Buffer> {
    const { strToU8, zipSync } = await import('fflate');

    const entries: Record<string, Uint8Array> = Object.fromEntries(files.map((file) => [file.name, new Uint8Array(file.data)]));
    entries['README.txt'] = strToU8(
        `motonui Instagram Export
Formato: ${INSTAGRAM_FORMATS[format].label}
File: ${files.length}
Creato: ${new Date().toISOString()}

Importa i file nell'app Instagram nell'ordine dei nomi.
`,
    );

    return Buffer.from(zipSync(entries));
}
