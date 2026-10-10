// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards SR-AUTHZ-03: every handler under /api/trips/[id]/** must check trip
 * membership, either through withRoute({ tripMember: true }) or by calling
 * requireTripMember. RLS alone is not enough for routes that fall back to the
 * service role. A new route without the check fails this test.
 */
const TRIP_ROUTES_DIR = join(process.cwd(), 'src/app/api/trips/[id]');
const HANDLER = /export const (GET|POST|PUT|PATCH|DELETE)\s*=\s*(withRoute|withErrorHandler)\(/g;

function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return routeFiles(path);
        return entry.name === 'route.ts' ? [path] : [];
    });
}

/** Splits a route file into one source chunk per exported handler. */
function handlers(source: string): Array<{ method: string; wrapper: string; code: string }> {
    const matches = [...source.matchAll(HANDLER)];
    return matches.map((match, i) => ({
        method: match[1],
        wrapper: match[2],
        code: source.slice(match.index, matches[i + 1]?.index ?? source.length),
    }));
}

describe('trip route authorization', () => {
    const files = routeFiles(TRIP_ROUTES_DIR);

    it('finds the trip routes', () => {
        expect(files.length).toBeGreaterThan(20);
    });

    it.each(files.map((file) => [relative(process.cwd(), file), file]))('%s checks trip membership in every handler', (_label, file) => {
        const source = readFileSync(file, 'utf8');
        const found = handlers(source);
        expect(found.length, 'no exported handler wrapped in withRoute/withErrorHandler').toBeGreaterThan(0);

        for (const { method, wrapper, code } of found) {
            const checked = wrapper === 'withRoute'
                ? /tripMember:\s*true/.test(code)
                : /requireTripMember\(/.test(code);
            expect(checked, `${method} does not check trip membership`).toBe(true);
        }
    });

    it('has no bare exported handlers outside the wrappers', () => {
        const bare = files.filter((file) => /export (async )?function (GET|POST|PUT|PATCH|DELETE)\b/.test(readFileSync(file, 'utf8')));
        expect(bare.map((file) => relative(process.cwd(), file))).toEqual([]);
    });
});
