// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards audit A4 (SR-WEB-05, SR-INPUT-01): every handler under /api/admin/**
 * runs inside withAdminRoute (admin check, UUID params, generic 500s,
 * no-store), except the cron routes, which authenticate with CRON_SECRET, and
 * the Sentry check, which throws on purpose. A new admin route exported as a
 * plain function fails here.
 */
const ADMIN_DIR = join(process.cwd(), 'src/app/api/admin');
const CRON_OR_DIAGNOSTIC = new Set(['cleanup', 'send-reminders', 'sentry-test']);
const EXPORTED = /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b[^\n]*/g;

function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return routeFiles(path);
        return entry.name === 'route.ts' ? [path] : [];
    });
}

const files = routeFiles(ADMIN_DIR).filter((file) => !CRON_OR_DIAGNOSTIC.has(relative(ADMIN_DIR, file).split('/')[0]));

describe('admin routes', () => {
    it('finds the admin routes', () => {
        expect(files.length).toBeGreaterThanOrEqual(10);
    });

    it.each(files.map((file) => [relative(process.cwd(), file), file]))('%s wraps every handler in withAdminRoute', (_label, file) => {
        const source = readFileSync(file, 'utf8');
        const exported = [...source.matchAll(EXPORTED)];

        expect(exported.length).toBeGreaterThan(0);
        for (const [line] of exported) {
            expect(line, line).toMatch(/=\s*withAdminRoute(<[^>]+>)?\(/);
        }
        // The database or Auth message never reaches the response body.
        expect(source).not.toMatch(/error:\s*[a-zA-Z]*[eE]rror\.message/);
        expect(source).not.toMatch(/['"]\s*\+\s*error\.message/);
    });
});
