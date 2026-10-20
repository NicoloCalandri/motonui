import { createMiddleware } from 'hono/factory';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { AppError } from '../lib/errors';
import type { AppEnv } from '../types';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Called server to server with their own secret (see lib/auth/cron.ts). */
export const CRON_ROUTES = new Set(['/api/admin/send-reminders', '/api/admin/cleanup']);

/** Public and cacheable: GET /api/posts/:slug. Everything else under /api is per user. */
const PUBLIC_CACHEABLE = /^\/api\/posts\/[^/]+$/;

/**
 * Origins of the web app, from WEB_ORIGIN (comma separated). In development
 * the Vite dev server is allowed by default. Read on every call so tests and
 * a changed environment are honoured.
 */
export function allowedOrigins(): Set<string> {
    const origins = new Set<string>();
    for (const value of (process.env.WEB_ORIGIN ?? '').split(',')) {
        try {
            origins.add(new URL(value.trim()).origin);
        } catch {
            // Empty or malformed entry: ignored, never widened to "any origin".
        }
    }
    if (process.env.NODE_ENV === 'development') origins.add('http://localhost:5173');
    return origins;
}

/**
 * CORS for the web app only. An origin that is not configured gets no
 * Access-Control-Allow-Origin header at all: the previous setup reflected
 * every origin together with credentials.
 */
export const corsPolicy = cors({
    origin: (origin) => (allowedOrigins().has(origin) ? origin : null),
    credentials: true,
});

function isCrossSiteWrite(c: Context): boolean {
    const trusted = allowedOrigins();
    trusted.add(new URL(c.req.url).origin);

    const origin = c.req.header('origin');
    if (origin) return !trusted.has(origin);

    // No Origin: browsers still label the request; curl, the mobile app and
    // other servers send neither header and are left to authentication.
    const fetchSite = c.req.header('sec-fetch-site');
    return fetchSite === 'cross-site' || fetchSite === 'same-site';
}

/**
 * Refuses state-changing requests that come from another site (port of
 * isCrossSiteWrite in src/middleware.ts, SR-WEB-04).
 */
export const rejectCrossSiteWrites = createMiddleware<AppEnv>(async (c, next) => {
    if (WRITE_METHODS.has(c.req.method) && !CRON_ROUTES.has(c.req.path) && isCrossSiteWrite(c)) {
        throw new AppError('Richiesta non consentita da un sito esterno.', 'CROSS_SITE_REQUEST', 403);
    }
    await next();
});

/** API responses are per user: never stored by browsers or proxies, unless a handler says otherwise. */
export const noStore = createMiddleware<AppEnv>(async (c, next) => {
    await next();
    const isPublic = c.req.method === 'GET' && PUBLIC_CACHEABLE.test(c.req.path);
    if (!isPublic && !c.res.headers.has('cache-control')) {
        c.res.headers.set('Cache-Control', 'private, no-store');
    }
});
