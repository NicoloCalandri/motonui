/**
 * Boarding passes live in the private `trip-documents` bucket (T-0.9,
 * SR-PRIV-02). Paths are built by the server and never trusted from the DB
 * without checking they belong to the trip in the request URL.
 *
 * Pure helpers only: this module is imported by client components and by
 * scripts/migrate-boarding-passes.ts, so it must not import server code.
 */

export const TRIP_DOCUMENTS_BUCKET = 'trip-documents';
export const LEGACY_PUBLIC_BUCKET = 'trip-media';

const EXTENSION_BY_MIME: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
};

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
    Object.entries(EXTENSION_BY_MIME).map(([mime, ext]) => [ext, mime]),
);
MIME_BY_EXTENSION.jpeg = 'image/jpeg';

/** Extension for an allowed boarding pass MIME type, or null if not allowed. */
export function boardingPassExtension(mimeType: string): string | null {
    return EXTENSION_BY_MIME[mimeType] ?? null;
}

/** MIME type inferred from a stored path, defaulting to a safe binary type. */
export function boardingPassMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

export function boardingPassPrefix(tripId: string): string {
    return `trips/${tripId}/boarding-passes/`;
}

/**
 * Builds a non-guessable storage path for a boarding pass. The random part
 * replaces the old predictable `{legId}.{ext}` name.
 */
export function buildBoardingPassPath(
    tripId: string,
    legId: string,
    extension: string,
    randomId: string = crypto.randomUUID(),
): string {
    return `${boardingPassPrefix(tripId)}${legId}-${randomId}.${extension}`;
}

/**
 * True only for a path directly under `trips/{tripId}/boarding-passes/`
 * without traversal. Guards every read and delete done with the service role,
 * because the path column is writable by trip members via REST.
 */
export function isBoardingPassPathForTrip(path: string | null | undefined, tripId: string): path is string {
    if (!path) return false;
    const prefix = boardingPassPrefix(tripId);
    if (!path.startsWith(prefix)) return false;
    const fileName = path.slice(prefix.length);
    return /^[A-Za-z0-9._-]+$/.test(fileName) && !fileName.startsWith('.');
}

/**
 * Extracts the object path from a legacy public `trip-media` URL
 * (`{supabaseUrl}/storage/v1/object/public/trip-media/{path}`), or null.
 */
export function legacyBoardingPassPath(url: string | null | undefined, supabaseUrl: string): string | null {
    if (!url) return null;
    const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${LEGACY_PUBLIC_BUCKET}/`;
    if (!url.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.slice(prefix.length).split('?')[0]);
    return path || null;
}

export interface BoardingPassLeg {
    id: string;
    trip_id: string;
    day_id: string | null;
    boarding_pass_path?: string | null;
    boarding_pass_url: string | null;
}

export function hasBoardingPass(leg: BoardingPassLeg): boolean {
    return Boolean(leg.boarding_pass_path || leg.boarding_pass_url);
}

/**
 * Same-origin URL that serves the boarding pass after an auth and membership
 * check. Falls back to the legacy public URL until the leg is migrated by
 * scripts/migrate-boarding-passes.ts.
 */
export function boardingPassHref(leg: BoardingPassLeg, options: { download?: boolean } = {}): string | null {
    if (leg.boarding_pass_path && leg.day_id) {
        const base = `/api/trips/${leg.trip_id}/days/${leg.day_id}/legs/${leg.id}/boarding-pass`;
        return options.download ? `${base}?download=1` : base;
    }
    return leg.boarding_pass_url ?? null;
}

export function isPdfBoardingPass(leg: BoardingPassLeg): boolean {
    const source = leg.boarding_pass_path ?? leg.boarding_pass_url ?? '';
    return source.split('?')[0].toLowerCase().endsWith('.pdf');
}
