import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { Context } from 'hono';
import type { AppEnv } from './types';

/**
 * Serves the built web app (apps/web/dist) from the API process, so that the
 * two share an origin: the session cookie and the token added to the plain
 * API calls of the copied components depend on it. Enabled by WEB_DIST; in development
 * Vite serves the app and proxies /api here instead.
 *
 * A path is a file of the build, or the app shell (index.html) for the routes
 * the browser handles. Requests under /api never reach the shell.
 */

const TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
};

const SUPABASE = ['https://*.supabase.co', 'wss://*.supabase.co'];
const MAPBOX = ['https://api.mapbox.com', 'https://*.mapbox.com', 'https://events.mapbox.com'];
const SENTRY = ['https://*.ingest.sentry.io', 'https://*.ingest.de.sentry.io'];

/**
 * Content security policy of the app shell: the counterpart of src/lib/csp.ts.
 * The build has no inline script, so scripts need neither a nonce nor
 * 'unsafe-inline'. The Supabase project in use is added by origin, for a
 * self-hosted or local one.
 */
export function contentSecurityPolicy(supabaseUrl: string | undefined = process.env.SUPABASE_URL): string {
    let own: string[] = [];
    try {
        if (supabaseUrl) {
            const url = new URL(supabaseUrl);
            own = [url.origin, url.origin.replace(/^http/, 'ws')];
        }
    } catch {
        own = [];
    }
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.mapbox.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:', ...own.filter((origin) => origin.startsWith('http'))],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'connect-src': ["'self'", ...SUPABASE, ...MAPBOX, ...SENTRY, ...own],
        'worker-src': ["'self'", 'blob:'],
        'child-src': ["'self'", 'blob:'],
        'frame-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
    };
    return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

export function webApp(dist: string) {
    const root = resolve(dist);
    const shell = join(root, 'index.html');

    /** The file a path names, only if it is inside the build. */
    const fileFor = (pathname: string): string | null => {
        let decoded: string;
        try {
            decoded = decodeURIComponent(pathname);
        } catch {
            return null;
        }
        if (decoded.includes('\0') || decoded.includes('\\')) return null;
        const candidate = resolve(root, `.${decoded}`);
        if (candidate !== root && !candidate.startsWith(root + sep)) return null;
        return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
    };

    return (c: Context<AppEnv>): Response => {
        const { pathname } = new URL(c.req.url);
        if (pathname === '/api' || pathname.startsWith('/api/')) return c.notFound() as Response;

        const file = pathname === '/' ? null : fileFor(pathname);
        if (file && file !== shell) {
            return new Response(readFileSync(file), {
                headers: {
                    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
                    // Build assets carry a content hash in their name.
                    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
                },
            });
        }

        // A missing asset is an error of the page, not a route of the app.
        if (pathname.startsWith('/assets/') || !existsSync(shell)) return c.notFound() as Response;

        return new Response(readFileSync(shell), {
            headers: {
                'Content-Type': TYPES['.html'],
                'Cache-Control': 'no-cache',
                'Content-Security-Policy': contentSecurityPolicy(),
            },
        });
    };
}
