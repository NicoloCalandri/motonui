import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

/**
 * The web app (apps/web) may call only routes this API serves. Every
 * `/api/…` path written in its sources must be a route, and every call whose
 * method is written next to the path must match a route with that method.
 * A page calling a route that was renamed or removed fails here, not in the
 * browser.
 */

const WEB_SRC = join(process.cwd(), '..', 'web', 'src');
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

/** Comments describe the old app and name routes that are gone: only code counts. */
export function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** `/api/trips/${id}/days?x=1` → `/api/trips/:param/days` */
export function normalizePath(path: string): string {
    return path
        .split('?')[0]
        .replace(/\$\{[^}]*\}/g, ':param')
        .replace(/:[A-Za-z]+/g, ':param')
        .replace(/\/+$/, '');
}

type Call = { file: string; path: string; method: string | null };

/** Every `/api/…` string or template literal, with the method when it is written in the same call. */
export function apiCalls(source: string, file: string): Call[] {
    const code = stripComments(source);
    const calls: Call[] = [];
    const literal = /([`'"])(\/api\/(?:(?!\1).)*)\1/g;
    for (const match of code.matchAll(literal)) {
        const start = match.index ?? 0;
        // The options object of the same call: up to the next API literal or 300 characters.
        const rest = code.slice(start + match[0].length, start + match[0].length + 300);
        const next = rest.search(/[`'"]\/api\//);
        const options = next >= 0 ? rest.slice(0, next) : rest;
        const method = /^\s*,\s*\{[^}]*?method:\s*'([A-Z]+)'/.exec(options)?.[1] ?? null;
        const isCall = /(?:apiFetch(?:<[^>(]*>)?|fetch)\(\s*$/.test(code.slice(Math.max(0, start - 80), start));
        calls.push({ file, path: normalizePath(match[2]), method: method ?? (isCall && /^\s*[,)]/.test(options) && !/^\s*,\s*\{/.test(options) ? 'GET' : null) });
    }
    return calls;
}

const routes = new Set(
    createApp().routes
        .filter((route) => METHODS.has(route.method) && !route.path.endsWith('*'))
        .map((route) => `${route.method} ${normalizePath(route.path)}`),
);
const paths = new Set([...routes].map((route) => route.split(' ')[1]));

const calls = sourceFiles(WEB_SRC).flatMap((path) => apiCalls(readFileSync(path, 'utf8'), relative(WEB_SRC, path).split(sep).join('/')));

describe('web client contract', () => {
    it('finds the calls of the web app', () => {
        expect(calls.length).toBeGreaterThan(25);
        expect(calls.filter((call) => call.method !== null).length).toBeGreaterThan(10);
    });

    it('every path the web app names is a route of the API', () => {
        const unknown = calls.filter((call) => !paths.has(call.path)).map((call) => `${call.path}  (${call.file})`);

        expect(unknown).toEqual([]);
    });

    it('every call with a written method matches a route with that method', () => {
        const unknown = calls
            .filter((call) => call.method !== null && paths.has(call.path) && !routes.has(`${call.method} ${call.path}`))
            .map((call) => `${call.method} ${call.path}  (${call.file})`);

        expect(unknown).toEqual([]);
    });
});

describe('web sources', () => {
    it('no component formats a typed time in the browser zone', () => {
        // Departures, arrivals and check-in openings are wall-clock times stored
        // in UTC: they go through lib/wall-clock.ts (see typed-times.test.tsx).
        const typed = /new Date\(\s*[\w.?]*\b(departure_at|arrival_at|checkin_opens_at)\)\s*(?:,|\.toLocale)/;
        const offenders = sourceFiles(WEB_SRC)
            .filter((path) => typed.test(stripComments(readFileSync(path, 'utf8'))))
            .map((path) => relative(WEB_SRC, path).split(sep).join('/'));

        expect(offenders).toEqual([]);
    });
});

describe('apiCalls', () => {
    it('reads the path and the method of a call', () => {
        const source = "await apiFetch<Trip>(`/api/trips/${id}/days/${dayId}`, { method: 'DELETE' }, token);";

        expect(apiCalls(source, 'a.ts')).toEqual([{ file: 'a.ts', path: '/api/trips/:param/days/:param', method: 'DELETE' }]);
    });

    it('reads a call without options as a GET', () => {
        expect(apiCalls("apiFetch<Trip[]>('/api/trips', undefined, token)", 'a.ts')[0]).toMatchObject({ method: 'GET' });
        expect(apiCalls("apiFetch<Trip[]>('/api/trips')", 'a.ts')[0]).toMatchObject({ path: '/api/trips', method: 'GET' });
    });

    it('leaves the method open when it is computed', () => {
        const source = "apiFetch('/api/trips', { method: editing ? 'PUT' : 'POST', body }, token)";

        expect(apiCalls(source, 'a.ts')[0]).toMatchObject({ method: null });
    });

    it('reads a multi-line call and ignores the query string', () => {
        const source = "fetch(\n  `/api/trips/${id}/media?day_id=${day}`,\n  {\n    method: 'POST',\n    body,\n  },\n)";

        expect(apiCalls(source, 'a.ts')[0]).toMatchObject({ path: '/api/trips/:param/media', method: 'POST' });
    });

    it('keeps a path that is only assigned to a variable, without a method', () => {
        expect(apiCalls('const url = `/api/trips/${id}/legs`;', 'a.ts')).toEqual([{ file: 'a.ts', path: '/api/trips/:param/legs', method: null }]);
    });

    it('ignores comments', () => {
        expect(apiCalls("/** old: fetch('/api/trips/invite') */\n// fetch('/api/gone')\n", 'a.ts')).toEqual([]);
    });
});
