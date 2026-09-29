/**
 * Instagram export planning (T-2.7, FR-34–35). Pure and client-safe: the
 * generator UI uses it for the preview and the server for the actual export,
 * so both agree on order, size and which photos are left out.
 */

export const INSTAGRAM_FORMATS = {
    carousel: { label: 'Carosello', ratio: '4:5', width: 1080, height: 1350, maxSlides: 10 },
    story: { label: 'Storia', ratio: '9:16', width: 1080, height: 1920, maxSlides: 1 },
} as const;

export type InstagramFormat = keyof typeof INSTAGRAM_FORMATS;

export interface SlideSource {
    id: string;
    mime_type: string | null;
    storage_path: string | null;
    signed_thumb_url?: string | null;
    signed_url?: string | null;
}

export type SkipReason = 'video' | 'not_uploaded' | 'over_limit' | 'duplicate';

export interface Slide {
    index: number;
    mediaId: string;
    storagePath: string;
    fileName: string;
    width: number;
    height: number;
    previewUrl: string | null;
}

export interface SlidePlan {
    format: InstagramFormat;
    slides: Slide[];
    skipped: Array<{ mediaId: string; reason: SkipReason }>;
}

/**
 * Keeps the user's order, drops videos, external links and duplicates, and
 * caps the slide count of the format. Files are named in slide order.
 */
export function buildSlides(media: SlideSource[], format: InstagramFormat): SlidePlan {
    const spec = INSTAGRAM_FORMATS[format];
    const slides: Slide[] = [];
    const skipped: SlidePlan['skipped'] = [];
    const seen = new Set<string>();

    for (const item of media) {
        if (seen.has(item.id)) {
            skipped.push({ mediaId: item.id, reason: 'duplicate' });
            continue;
        }
        seen.add(item.id);

        if (item.mime_type?.startsWith('video/')) {
            skipped.push({ mediaId: item.id, reason: 'video' });
        } else if (!item.storage_path) {
            skipped.push({ mediaId: item.id, reason: 'not_uploaded' });
        } else if (slides.length >= spec.maxSlides) {
            skipped.push({ mediaId: item.id, reason: 'over_limit' });
        } else {
            const index = slides.length + 1;
            slides.push({
                index,
                mediaId: item.id,
                storagePath: item.storage_path,
                fileName: `${format}_${String(index).padStart(2, '0')}.jpg`,
                width: spec.width,
                height: spec.height,
                previewUrl: item.signed_thumb_url ?? item.signed_url ?? null,
            });
        }
    }

    return { format, slides, skipped };
}

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
    video: 'i video non sono esportabili',
    not_uploaded: 'solo le foto caricate su motonui si possono esportare',
    over_limit: 'oltre il numero massimo di slide',
    duplicate: 'selezionata due volte',
};
