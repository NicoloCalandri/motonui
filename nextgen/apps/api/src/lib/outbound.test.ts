import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOwnStorageUrl } from './media/storage-url';

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
        // The only exceptions: safeFetch itself, the download of our own
        // storage objects, which is checked by isOwnStorageUrl, and the
        // revocation check of impersonation tokens, which queries a fixed path
        // of our own Supabase project (the URL comes from the environment).
        const allowed = new Set(['lib/safe-fetch.ts', 'lib/media/instagram-export.ts', 'lib/admin/impersonation-token.ts']);
        const offenders = sourceFiles(SRC)
            .filter((path) => /(^|[^.\w])fetch\(/.test(readFileSync(path, 'utf8')))
            .map((path) => relative(SRC, path).split(sep).join('/'))
            .filter((path) => !allowed.has(path));

        expect(offenders).toEqual([]);
    });

    it('the Instagram export checks the media URL before downloading it', () => {
        const source = readFileSync(join(SRC, 'lib/media/instagram-export.ts'), 'utf8');
        expect(source.indexOf('isOwnStorageUrl(media.url)')).toBeGreaterThan(-1);
        expect(source.indexOf('isOwnStorageUrl(media.url)')).toBeLessThan(source.indexOf('fetch(media.url)'));
    });
});

describe('isOwnStorageUrl', () => {
    const SUPABASE = 'https://abc.supabase.co';

    it('accepts objects of our own storage', () => {
        expect(isOwnStorageUrl('https://abc.supabase.co/storage/v1/object/public/trip-media/a.jpg', SUPABASE)).toBe(true);
        expect(isOwnStorageUrl('https://abc.supabase.co/storage/v1/object/sign/trip-media/a.jpg?token=x', SUPABASE)).toBe(true);
        expect(isOwnStorageUrl('http://127.0.0.1:54321/storage/v1/object/public/trip-media/a.jpg', 'http://127.0.0.1:54321')).toBe(true);
    });

    it.each([
        'https://evil.example/storage/v1/object/public/trip-media/a.jpg',
        'https://abc.supabase.co.evil.example/storage/v1/object/public/a.jpg',
        'https://abc.supabase.co/rest/v1/profiles',
        'https://abc.supabase.co/storage/v1/object/../../auth/v1/admin/users',
        'http://abc.supabase.co/storage/v1/object/public/a.jpg',
        'https://user:pass@abc.supabase.co/storage/v1/object/public/a.jpg',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'not a url',
        '',
    ])('refuses %s', (url) => {
        expect(isOwnStorageUrl(url, SUPABASE)).toBe(false);
    });
});
