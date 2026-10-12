import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
}

describe('outbound requests', () => {
    it('go through safeFetch: no other file calls fetch() directly', () => {
        // The only exceptions: safeFetch itself, and the revocation check of
        // impersonation tokens, which queries a fixed path of our own Supabase
        // project (the URL comes from the environment).
        const allowed = new Set(['lib/safe-fetch.ts', 'lib/admin/impersonation-token.ts']);
        const offenders = sourceFiles(SRC)
            .filter((path) => /(^|[^.\w])fetch\(/.test(readFileSync(path, 'utf8')))
            .map((path) => relative(SRC, path).split(sep).join('/'))
            .filter((path) => !allowed.has(path));

        expect(offenders).toEqual([]);
    });

    it('the Instagram export reads photos from storage by path, never from a URL', () => {
        const source = readFileSync(join(SRC, 'lib/media/instagram-export.ts'), 'utf8');
        expect(source).toContain('isTripFilePath(');
        expect(source).not.toMatch(/\.url\b/);
    });
});
