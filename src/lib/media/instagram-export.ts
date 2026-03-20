import type { SupabaseClient } from '@supabase/supabase-js';
import type { InstagramExportOptions, InstagramType, Media } from '@/lib/types';
import { cropToAspect, applyFilter, overlayText } from '@/lib/media/process';
import { uploadFile, Buckets } from '@/lib/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateExportInput {
    exportId: string;
    tripId: string;
    mediaIds: string[];
    type: InstagramType;
    options: Record<string, unknown>;
    generateCaption: boolean;
    language: 'it' | 'en';
    supabase: SupabaseClient;
}

interface CaptionResult {
    caption: string;
    hashtags: string[];
}

interface GenerateExportOutput {
    downloadUrl: string;
    captionResult?: CaptionResult;
}

// ─── Dimension Config per Instagram type ─────────────────────────────────────

const TYPE_CONFIG = {
    carousel: { ratio: '4:5' as const, maxSlides: 10 },
    story: { ratio: '9:16' as const, maxSlides: 1 },
    reel: { ratio: '9:16' as const, maxSlides: 1 },
};

// ─── Main Export Function ─────────────────────────────────────────────────────

/**
 * Orchestrates the full Instagram export pipeline:
 * 1. Fetch media records from DB
 * 2. Download source images
 * 3. Apply crop + filter + optional text overlay
 * 4. Bundle as ZIP and upload to instagram-exports bucket
 * 5. Optionally generate AI caption
 */
export async function generateExport(input: GenerateExportInput): Promise<GenerateExportOutput> {
    const {
        exportId, tripId, mediaIds, type, options, generateCaption, language, supabase,
    } = input;

    const config = TYPE_CONFIG[type];
    const exportOptions = options as Partial<InstagramExportOptions>;

    // 1. Fetch media records
    const { data: mediaRows, error } = await supabase
        .from('media')
        .select('id, url, caption')
        .in('id', mediaIds.slice(0, config.maxSlides));

    if (error || !mediaRows?.length) {
        throw new Error(`[motonui][instagram-export] No media found: ${error?.message ?? 'empty'}`);
    }

    // 2. Process each image
    const processedBuffers: Buffer[] = [];

    for (const media of mediaRows as Media[]) {
        // Fetch source image
        const res = await fetch(media.url);
        if (!res.ok) {
            throw new Error(`[motonui][instagram-export] Cannot fetch media ${media.id}: ${res.status}`);
        }
        let buffer = Buffer.from(await res.arrayBuffer() as ArrayBuffer);

        // Crop to correct aspect ratio
        buffer = await cropToAspect(buffer, config.ratio) as any;

        // Apply filter
        const filter = exportOptions.filter ?? 'none';

        // applyFilter returns a Buffer but needs to accept our filter type
        const { applyFilter: filterFn } = await import('@/lib/media/process');
        buffer = await filterFn(buffer, filter) as any;

        // Optional text overlay
        if (exportOptions.textOverlay) {
            buffer = await overlayText(buffer, exportOptions.textOverlay) as any;
        }

        processedBuffers.push(buffer);
    }

    // 3. Bundle into ZIP using fflate (browser+node compatible)
    const zipBuffer = await bundleAsZip(processedBuffers, type);

    // 4. Upload ZIP
    const zipPath = `${tripId}/${exportId}.zip`;
    const downloadUrl = await uploadFile(
        Buckets.instagramExports,
        zipPath,
        zipBuffer,
        'application/zip'
    );

    // 5. Optionally generate caption
    let captionResult: CaptionResult | undefined;
    if (generateCaption) {
        try {
            const { generateCaption: genCap } = await import('@/lib/media/captions');
            const captions = mediaRows.map((m) => (m as Media).caption ?? '').filter(Boolean);
            captionResult = await genCap({ captions, type, language });
        } catch (err) {
            console.warn('[motonui][instagram-export] Caption generation failed:', err);
        }
    }

    return { downloadUrl, captionResult };
}

// ─── ZIP bundler ──────────────────────────────────────────────────────────────

async function bundleAsZip(buffers: Buffer[], type: InstagramType): Promise<Buffer> {
    const { strToU8, zipSync } = await import('fflate');

    const files: Record<string, Uint8Array> = Object.fromEntries(
        buffers.map((buf, i) => [
            `${type}_${String(i + 1).padStart(2, '0')}.jpg`,
            new Uint8Array(buf),
        ])
    );

    // Add README
    files['README.txt'] = strToU8(
        `motonui Instagram Export
Type: ${type}
Files: ${buffers.length}
Generated: ${new Date().toISOString()}

Import these files directly into the Instagram app.
`
    );

    return Buffer.from(zipSync(files));
}
