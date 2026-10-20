import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { WEB_COPIES } from '../../../../scripts/port-manifest.mjs';

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
    // At least one character after the prefix: '/api/' alone is a prefix check, not a route.
    const literal = /([`'"])(\/api\/(?:(?!\1).)+)\1/g;
    for (const match of code.matchAll(literal)) {
        const start = match.index ?? 0;
        const rest = code.slice(start + match[0].length);
        const isCall = /(?:apiFetch(?:<[^>(]*>)?|fetch)\(\s*$/.test(code.slice(Math.max(0, start - 80), start));
        calls.push({ file, path: normalizePath(match[2]), method: isCall ? methodOf(rest) : null });
    }
    return calls;
}

/**
 * Method of a call, from what follows its path: none or `undefined` options
 * and an options object that names no method are a GET; a written
 * `method: 'X'` is X; anything else (a variable, a computed method) is unknown.
 */
function methodOf(rest: string): string | null {
    if (/^\s*\)/.test(rest) || /^\s*,\s*undefined\b/.test(rest)) return 'GET';
    const open = /^\s*,\s*\{/.exec(rest);
    if (!open) return null;

    let depth = 0;
    let end = -1;
    for (let i = open[0].length - 1; i < rest.length; i += 1) {
        if (rest[i] === '{') depth += 1;
        if (rest[i] === '}') depth -= 1;
        if (depth === 0) { end = i; break; }
    }
    if (end < 0) return null;

    const options = rest.slice(open[0].length - 1, end + 1);
    const written = /\bmethod:\s*'([A-Z]+)'/.exec(options);
    if (written) return written[1];
    return /\bmethod\b/.test(options) ? null : 'GET';
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

/**
 * Files copied from the Next.js app (WEB_COPIES) cannot be fixed here: what the
 * two guards below find in them is a defect of the source, listed so that it
 * stays visible. A list shrinks when the source is fixed and re-ported; it
 * must never grow without a look at the new entry.
 */
const INHERITED_CALENDAR_DATES = [
    'components/calendar/TripCalendar.tsx',
    'components/calendar/calendar-events.ts',
    'components/trip/packing-cards.tsx',
];
const INHERITED_TYPED_TIMES = ['components/calendar/calendar-events.ts'];

describe('web sources', () => {
    it('shows no copy the Next.js app has retired', () => {
        // Brand voice (docs/brand-voice.md): Italian, "motonui" lowercase, errors
        // as "Ops! … 🏝️". Each entry was replaced in the Next.js app.
        const retired = [
            'Errore imprevisto', 'Errore con Google', "Errore durante l'eliminazione", 'Errore nel salvataggio',
            'Motonui App', 'Travel App', 'Accedi / Registrati', 'Chi siamo', 'Diario AI',
            'Recent Trips', 'Location Live', 'Welcome Back', 'Remember me', 'Log in to your account', 'Go around the world',
            'Tutto quello che ti serve', 'viaggio perfetto',
        ];
        const found = sourceFiles(WEB_SRC).flatMap((path) => {
            const code = stripComments(readFileSync(path, 'utf8'));
            return retired.filter((text) => code.includes(text)).map((text) => `${text}  (${relative(WEB_SRC, path).split(sep).join('/')})`);
        });

        expect(found).toEqual([]);
    });

    it('no component reads a calendar date as a UTC instant', () => {
        // new Date('2026-11-01') is midnight UTC: formatted in a zone west of
        // UTC it shows 31 October. Calendar dates go through lib/calendar-date.ts.
        const calendar = /new Date\(\s*[\w.?]*\.(date|check_in|check_out|start_date|end_date|start|end|payment_deadline|cancellation_deadline)\)/;
        const offenders = sourceFiles(WEB_SRC)
            .filter((path) => calendar.test(stripComments(readFileSync(path, 'utf8'))))
            .map((path) => relative(WEB_SRC, path).split(sep).join('/'));

        expect(offenders.filter((file) => !WEB_COPIES.includes(file))).toEqual([]);
        expect(offenders.filter((file) => WEB_COPIES.includes(file)).sort()).toEqual(INHERITED_CALENDAR_DATES);
    });

    it('no component formats a typed time in the browser zone', () => {
        // Departures, arrivals and check-in openings are wall-clock times stored
        // in UTC: they go through lib/wall-clock.ts (see typed-times.test.tsx).
        const typed = /new Date\(\s*[\w.?]*\b(departure_at|arrival_at|checkin_opens_at)\)\s*(?:,|\.toLocale)/;
        const offenders = sourceFiles(WEB_SRC)
            .filter((path) => typed.test(stripComments(readFileSync(path, 'utf8'))))
            .map((path) => relative(WEB_SRC, path).split(sep).join('/'));

        expect(offenders.filter((file) => !WEB_COPIES.includes(file))).toEqual([]);
        expect(offenders.filter((file) => WEB_COPIES.includes(file)).sort()).toEqual(INHERITED_TYPED_TIMES);
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

    it('reads a call whose options name no method as a GET', () => {
        expect(apiCalls('apiFetch<Trip>(`/api/trips/${id}`, {}, token)', 'a.ts')[0]).toMatchObject({ method: 'GET' });
        expect(apiCalls("fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })", 'a.ts')[0]).toMatchObject({ method: 'GET' });
    });

    it('leaves the method open when the options carry one it cannot read', () => {
        expect(apiCalls("apiFetch('/api/trips', { method, body }, token)", 'a.ts')[0]).toMatchObject({ method: null });
        expect(apiCalls("apiFetch('/api/trips', options, token)", 'a.ts')[0]).toMatchObject({ method: null });
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
