/** Placeholder shipped in .env.example: Mapbox answers 401 to it. */
const PLACEHOLDER_PREFIX = 'pk.your-';

/**
 * The public Mapbox token, or null when it is missing or still the
 * .env.example placeholder: the map and the place search then stay off
 * instead of sending requests that Mapbox refuses.
 */
export function mapboxToken(raw: string | undefined = process.env.NEXT_PUBLIC_MAPBOX_TOKEN): string | null {
    const token = raw?.trim();
    if (!token || token.startsWith(PLACEHOLDER_PREFIX)) return null;
    return token;
}

/** Mapbox errors that mean the token is refused, not a tile that failed once. */
export function isMapboxAuthError(error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status;
    return status === 401 || status === 403;
}
