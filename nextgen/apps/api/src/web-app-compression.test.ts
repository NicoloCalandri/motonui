import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

/** Compression and caching of the static files (web-app.test.ts covers routing and traversal). */

/** Large and repetitive, like a bundle: worth compressing. */
const BIG = 'console.log("motonui");\n'.repeat(500);

let dist = '';

beforeAll(() => {
    const root = mkdtempSync(join(tmpdir(), 'motonui-web-gz-'));
    dist = join(root, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), `<!doctype html><title>motonui</title><div id="root"></div>${'<!-- pad -->'.repeat(200)}`);
    writeFileSync(join(dist, 'assets', 'big-def456.js'), BIG);
    writeFileSync(join(dist, 'assets', 'small-abc123.js'), 'console.log("app")');
    writeFileSync(join(dist, 'favicon.ico'), Buffer.alloc(2048, 7));
    writeFileSync(join(root, 'secret.txt'), 'outside the build');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const get = (path: string, headers: Record<string, string> = {}) => createApp({ webDist: dist }).request(path, { headers });

describe('compression and caching of the web app', () => {
    it('compresses a bundle with brotli when the browser accepts it', async () => {
        const res = await get('/assets/big-def456.js', { 'accept-encoding': 'gzip, deflate, br' });

        expect(res.headers.get('content-encoding')).toBe('br');
        expect(res.headers.get('vary')).toContain('Accept-Encoding');
        expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
        const body = Buffer.from(await res.arrayBuffer());
        expect(body.length).toBeLessThan(BIG.length / 5);
        expect(brotliDecompressSync(body).toString()).toBe(BIG);
    });

    it('falls back to gzip, then to the plain file', async () => {
        const zipped = await get('/assets/big-def456.js', { 'accept-encoding': 'gzip' });
        const plain = await get('/assets/big-def456.js');
        const refused = await get('/assets/big-def456.js', { 'accept-encoding': 'br;q=0, gzip;q=0' });

        expect(zipped.headers.get('content-encoding')).toBe('gzip');
        expect(gunzipSync(Buffer.from(await zipped.arrayBuffer())).toString()).toBe(BIG);
        expect(plain.headers.get('content-encoding')).toBeNull();
        expect(await plain.text()).toBe(BIG);
        expect(refused.headers.get('content-encoding')).toBeNull();
    });

    it('serves a repeated request from memory with the same bytes', async () => {
        const app = createApp({ webDist: dist });
        const request = () => app.request('/assets/big-def456.js', { headers: { 'accept-encoding': 'br' } });

        const first = Buffer.from(await (await request()).arrayBuffer());
        const second = Buffer.from(await (await request()).arrayBuffer());

        expect(second.equals(first)).toBe(true);
    });

    it('does not compress what is small or already compressed', async () => {
        const small = await get('/assets/small-abc123.js', { 'accept-encoding': 'br' });
        const icon = await get('/favicon.ico', { 'accept-encoding': 'br' });

        expect(small.headers.get('content-encoding')).toBeNull();
        expect(icon.headers.get('content-encoding')).toBeNull();
        expect(icon.headers.get('cache-control')).toBe('public, max-age=3600');
    });

    it('keeps the app shell uncached, compressed and with its policy', async () => {
        const res = await get('/dashboard', { 'accept-encoding': 'gzip' });

        expect(res.headers.get('cache-control')).toBe('no-cache');
        expect(res.headers.get('content-encoding')).toBe('gzip');
        expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
        expect(gunzipSync(Buffer.from(await res.arrayBuffer())).toString()).toContain('<div id="root">');
    });

    it('still refuses a path outside the build when compression is asked for', async () => {
        const res = await get('/..%2fsecret.txt', { 'accept-encoding': 'br' });

        expect(Buffer.from(await res.arrayBuffer()).toString()).not.toContain('outside the build');
        expect(res.headers.get('content-type') ?? '').not.toContain('text/plain');
    });
});
