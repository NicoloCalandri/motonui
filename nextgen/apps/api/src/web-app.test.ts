import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

/**
 * In production one process serves both the API and the built web app, so
 * that they share an origin: the session cookie and the token on plain
 * fetch('/api/…') calls depend on it. The API answers under /api; every
 * other path is a file of the build, or the app shell for client routes.
 */

let dist = '';

beforeAll(() => {
    const root = mkdtempSync(join(tmpdir(), 'motonui-web-'));
    dist = join(root, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>motonui</title><div id="root"></div>');
    writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
    writeFileSync(join(dist, 'assets', 'index-abc123.css'), 'body{}');
    writeFileSync(join(root, 'secret.txt'), 'outside the build');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const get = (path: string, webDist: string | undefined = dist) => createApp({ webDist }).request(path);

describe('serving the web app', () => {
    it('serves the app shell for a client route, never cached, with a content security policy', async () => {
        const res = await get('/trips/10000000-0000-4000-8000-00000000000a?tab=blog');

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(await res.text()).toContain('<div id="root">');
        expect(res.headers.get('cache-control')).toBe('no-cache');
        const csp = res.headers.get('content-security-policy') ?? '';
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toMatch(/script-src 'self'(;|$)/);
    });

    it('serves a build asset with its type and a long cache', async () => {
        const js = await get('/assets/index-abc123.js');
        const css = await get('/assets/index-abc123.css');

        expect(js.status).toBe(200);
        expect(js.headers.get('content-type')).toContain('javascript');
        expect(js.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
        expect(css.headers.get('content-type')).toContain('text/css');
    });

    it('answers 404 for a missing asset instead of the app shell', async () => {
        const res = await get('/assets/gone-123.js');

        expect(res.status).toBe(404);
    });

    it.each([
        '/../secret.txt',
        '/..%2fsecret.txt',
        '/%2e%2e/secret.txt',
        '/assets/../../secret.txt',
        '/assets/..%5c..%5csecret.txt',
    ])('never serves a file outside the build (%s)', async (path) => {
        const res = await get(path);

        expect(await res.text()).not.toContain('outside the build');
    });

    it('leaves the API alone: an unknown API path is the JSON 404, not the app shell', async () => {
        const res = await get('/api/does-not-exist');

        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toContain('json');
        expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('still answers the API', async () => {
        expect((await get('/api/health')).status).toBe(200);
    });

    it('serves nothing but the API when no build is configured', async () => {
        const res = await createApp({ webDist: undefined }).request('/trips');

        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toContain('json');
    });

    it('serves only GET and HEAD', async () => {
        const res = await createApp({ webDist: dist }).request('/trips', { method: 'POST' });

        expect(res.status).toBe(404);
    });
});
