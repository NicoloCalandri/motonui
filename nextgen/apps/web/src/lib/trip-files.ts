/**
 * Storage paths of trip files (T-2.1, T-2.3, T-2.4, SR-INPUT-07).
 *
 * Every file of a trip lives under `trips/{trip_id}/` in a private bucket:
 *   trip-media      original/{uuid}.{ext}, thumbs/{uuid}.webp
 *   trip-documents  documents/{uuid}.{ext}, boarding-passes/{legId}-{uuid}.{ext}
 * The server builds paths itself and re-checks any path read from the DB
 * with isTripFilePath() before using the service role on it.
 *
 * Pure helpers only: imported by client components too.
 */

export type MediaFolder = 'original' | 'thumbs';

/** Same value as Buckets.tripMedia, importable from client components. */
export const TRIP_MEDIA_BUCKET = 'trip-media';

const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

export function tripStoragePrefix(tripId: string): string {
    return `trips/${tripId}/`;
}

/**
 * True only for a path under `trips/{tripId}/` (and `folder/` if given) made of
 * plain segments: no traversal, no empty or hidden segments.
 */
export function isTripFilePath(
    path: string | null | undefined,
    tripId: string,
    folder?: string,
): path is string {
    if (!path) return false;
    const prefix = tripStoragePrefix(tripId) + (folder ? `${folder}/` : '');
    if (!path.startsWith(prefix)) return false;
    const segments = path.slice(prefix.length).split('/');
    return segments.length > 0 && segments.every((segment) => SEGMENT.test(segment) && !segment.includes('..'));
}

export function buildMediaPath(
    tripId: string,
    folder: MediaFolder,
    extension: string,
    randomId: string = crypto.randomUUID(),
): string {
    return `${tripStoragePrefix(tripId)}${folder}/${randomId}.${extension}`;
}

export function buildDocumentPath(tripId: string, extension: string, randomId: string = crypto.randomUUID()): string {
    return `${tripStoragePrefix(tripId)}documents/${randomId}.${extension}`;
}

/** The link only if it is an absolute https URL (no javascript:, data:, http:). */
export function safeExternalUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

export interface DocumentLinkSource {
    id: string;
    trip_id: string;
    file_path: string | null;
    file_url: string | null;
}

/**
 * Where the browser opens a document: the authenticated proxy for uploaded
 * files, otherwise the external link if it is https.
 */
export function documentHref(doc: DocumentLinkSource, options: { download?: boolean } = {}): string | null {
    if (doc.file_path) {
        const base = `/api/trips/${doc.trip_id}/documents/${doc.id}/file`;
        return options.download ? `${base}?download=1` : base;
    }
    return safeExternalUrl(doc.file_url);
}

export interface MediaSource {
    url: string | null;
    thumbnail_url: string | null;
    signed_url: string | null;
    signed_thumb_url: string | null;
}

/** Grid image: signed thumbnail, then signed original, then an https external link. */
export function mediaThumbSrc(media: MediaSource): string | undefined {
    return media.signed_thumb_url ?? media.signed_url ?? safeExternalUrl(media.thumbnail_url) ?? safeExternalUrl(media.url) ?? undefined;
}

/** Full-size image or video: signed original, then an https external link. */
export function mediaFullSrc(media: MediaSource): string | undefined {
    return media.signed_url ?? safeExternalUrl(media.url) ?? undefined;
}
