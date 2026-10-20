import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
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
 * 'unsafe-inline'. csp-parity.test.ts keeps the
 * directives equal to the Next.js ones. The Supabase project in use is added by origin, for a
 * self-hosted or local one.
 */
export function contentSecurityPolicy(
    supabaseUrl: string | undefined = process.env.SUPABASE_URL,
    production: boolean = process.env.NODE_ENV === 'production',
): string {
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
    const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
    // As in src/lib/csp.ts: not in development, where Supabase may be plain http.
    if (production) policy.push('upgrade-insecure-requests');
    return policy.join('; ');
}

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

/** Text formats worth compressing; images and fonts already are. */
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.map']);
/** Below this a compressed body saves nothing. */
const MIN_COMPRESS_BYTES = 1024;

type Encoding = 'br' | 'gzip' | 'identity';
type Entry = { raw: Buffer; br?: Buffer; gzip?: Buffer };

/** The best encoding the client accepts (Accept-Encoding, q-values ignored except q=0). */
function pickEncoding(header: string | undefined): Encoding {
    const accepted = new Set(
        (header ?? '').split(',').map((part) => part.trim().toLowerCase()).filter((part) => !/;\s*q=0(\.0*)?$/.test(part)).map((part) => part.split(';')[0]),
    );
    if (accepted.has('br')) return 'br';
    if (accepted.has('gzip')) return 'gzip';
    return 'identity';
}

export function webApp(dist: string) {
    const root = resolve(dist);
    const shell = join(root, 'index.html');

    // The build does not change while the process runs: files are read once
    // (re-read if their size or mtime changes) and compressed once per encoding.
    const cache = new Map<string, { stamp: string; entry: Promise<Entry> }>();

    const statFile = async (path: string) => {
        try {
            const info = await stat(path);
            return info.isFile() ? info : null;
        } catch {
            return null;
        }
    };

    /** The file a path names, only if it is inside the build. */
    const fileFor = async (pathname: string) => {
        let decoded: string;
        try {
            decoded = decodeURIComponent(pathname);
        } catch {
            return null;
        }
        if (decoded.includes('\0') || decoded.includes('\\')) return null;
        const candidate = resolve(root, `.${decoded}`);
        if (candidate !== root && !candidate.startsWith(root + sep)) return null;
        const info = await statFile(candidate);
        return info ? { path: candidate, info } : null;
    };

    const entryFor = (path: string, info: { size: number; mtimeMs: number }): Promise<Entry> => {
        const stamp = `${info.size}:${info.mtimeMs}`;
        const hit = cache.get(path);
        if (hit && hit.stamp === stamp) return hit.entry;
        const entry = readFile(path).then((raw): Entry => ({ raw }));
        cache.set(path, { stamp, entry });
        entry.catch(() => cache.delete(path));
        return entry;
    };

    const send = async (c: Context<AppEnv>, path: string, info: { size: number; mtimeMs: number }, headers: Record<string, string>) => {
        const type = TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
        const compressible = COMPRESSIBLE.has(extname(path).toLowerCase()) && info.size >= MIN_COMPRESS_BYTES;
        const entry = await entryFor(path, info);
        const encoding = compressible ? pickEncoding(c.req.header('accept-encoding')) : 'identity';
        let body = entry.raw;
        if (encoding === 'br') {
            entry.br ??= await brotliAsync(entry.raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } });
            body = entry.br;
        } else if (encoding === 'gzip') {
            entry.gzip ??= await gzipAsync(entry.raw);
            body = entry.gzip;
        }
        const out: Record<string, string> = { 'Content-Type': type, ...headers };
        if (compressible) out.Vary = 'Accept-Encoding';
        if (encoding !== 'identity') out['Content-Encoding'] = encoding;
        return new Response(new Uint8Array(body), { headers: out });
    };

    return async (c: Context<AppEnv>): Promise<Response> => {
        const { pathname } = new URL(c.req.url);
        if (pathname === '/api' || pathname.startsWith('/api/')) return c.notFound() as Response;

        const file = pathname === '/' ? null : await fileFor(pathname);
        if (file && file.path !== shell) {
            // Build assets carry a content hash in their name.
            const cacheControl = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
            return send(c, file.path, file.info, { 'Cache-Control': cacheControl });
        }

        // A missing asset is an error of the page, not a route of the app.
        const shellInfo = await statFile(shell);
        if (pathname.startsWith('/assets/') || !shellInfo) return c.notFound() as Response;

        return send(c, shell, shellInfo, {
            'Cache-Control': 'no-cache',
            'Content-Security-Policy': contentSecurityPolicy(),
        });
    };
}
