/**
 * Content-Security-Policy (T-4.4, SR-WEB-01/02). Built per request in the
 * middleware with a fresh nonce: Next.js adds it to its own scripts, and
 * 'strict-dynamic' lets those load their chunks. No 'unsafe-inline' or
 * 'unsafe-eval' for scripts in production (dev needs eval for React refresh).
 * The browser never talks to api.anthropic.com: AI calls are server-side.
 */

const SUPABASE = ['https://*.supabase.co', 'wss://*.supabase.co'];
const MAPBOX = ['https://api.mapbox.com', 'https://*.mapbox.com', 'https://events.mapbox.com'];
/** Sentry browser events (T-4.2), EU and US ingest. */
const SENTRY = ['https://*.ingest.sentry.io', 'https://*.ingest.de.sentry.io'];
const LOCAL_SUPABASE = ['http://127.0.0.1:54321', 'ws://127.0.0.1:54321', 'http://localhost:54321'];

export function createNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
}

export function buildCsp({ nonce, dev = false }: { nonce: string; dev?: boolean }): string {
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
        // Inline style attributes (React style={}, Mapbox, Tiptap) still need 'unsafe-inline'.
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.mapbox.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(dev ? LOCAL_SUPABASE : [])],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'connect-src': ["'self'", ...SUPABASE, ...MAPBOX, ...SENTRY, ...(dev ? LOCAL_SUPABASE : [])],
        // Mapbox GL runs its workers from blob: URLs.
        'worker-src': ["'self'", 'blob:'],
        'child-src': ["'self'", 'blob:'],
        // Documents (PDF) open in an iframe served by our own proxy route.
        'frame-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
    };
    const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
    if (!dev) policy.push('upgrade-insecure-requests');
    return policy.join('; ');
}
