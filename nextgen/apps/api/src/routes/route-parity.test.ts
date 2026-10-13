import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

/**
 * Keeps the Hono API from drifting away from the Next.js one while both
 * exist. Every method+path served by src/app/api must also be served here,
 * unless it is listed in KNOWN_GAPS. The list can only shrink: an entry that
 * is no longer a gap fails the test too.
 */

const NEXT_API = join(process.cwd(), '..', '..', '..', 'src', 'app', 'api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Routes of the Next.js API not ported yet. Empty since sub-plan B: a new Next.js route must be ported or listed here. */
const KNOWN_GAPS: string[] = [
];

/** Routes only Hono serves: leftovers of the old API, or Hono-only utilities. Same rule: the list only shrinks. */
const KNOWN_EXTRAS: string[] = [
    // Kept on purpose: liveness probe, and POST next to GET for manual cron runs.
    'GET /api/health',
    // What the SPA asks once per session: the Next.js app reads it on the server.
    'GET /api/session',
    'POST /api/session/cookie',
    'DELETE /api/session/cookie',
    'POST /api/session/cookie',
    'DELETE /api/session/cookie',
    'POST /api/admin/cleanup',
    'POST /api/admin/send-reminders',
];

function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return routeFiles(path);
        return entry.name === 'route.ts' ? [path] : [];
    });
}

/** Parameter names differ between the two apps ([accId] vs :accommodationId): only positions matter. */
function normalize(path: string): string {
    return path.replace(/\[[^\]]+\]|:[A-Za-z]+/g, ':param').replace(/\/$/, '');
}

function nextRoutes(): string[] {
    return routeFiles(NEXT_API).flatMap((file) => {
        const path = `/api/${relative(NEXT_API, file).split(sep).slice(0, -1).join('/')}`;
        const source = readFileSync(file, 'utf8');
        return METHODS
            .filter((method) => new RegExp(`export (const|async function|function) ${method}\\b`).test(source))
            .map((method) => `${method} ${normalize(path)}`);
    }).sort();
}

function honoRoutes(): Set<string> {
    const methods = new Set<string>(METHODS);
    return new Set(
        createApp().routes
            .filter((route) => methods.has(route.method) && !route.path.endsWith('*'))
            .map((route) => `${route.method} ${normalize(route.path)}`),
    );
}

describe('route parity with the Next.js API', () => {
    const next = nextRoutes();
    const hono = honoRoutes();
    const missing = next.filter((route) => !hono.has(route));

    it('reads both route tables', () => {
        expect(next.length).toBeGreaterThan(80);
        expect(hono.size).toBeGreaterThan(60);
        expect(next).toContain('GET /api/trips/:param/days');
        expect(hono.has('GET /api/trips/:param/days')).toBe(true);
    });

    it('serves every Next.js route, except the known gaps', () => {
        expect(missing.filter((route) => !KNOWN_GAPS.includes(route))).toEqual([]);
    });

    it('lists as gaps only routes that are really missing', () => {
        expect(KNOWN_GAPS.filter((route) => !missing.includes(route))).toEqual([]);
    });

    it('serves no route the Next.js API does not have, except the known extras', () => {
        const extras = [...hono].filter((route) => !next.includes(route)).sort();
        expect(extras.filter((route) => !KNOWN_EXTRAS.includes(route))).toEqual([]);
        expect(KNOWN_EXTRAS.filter((route) => !extras.includes(route))).toEqual([]);
    });
});
