import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';

const WEB = 'https://motonui.app';
const EVIL = 'https://evil.example';

function appWithProbes() {
    const app = createApp();
    const hit = vi.fn();
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        app[method]('/api/__write', (c) => {
            hit();
            return c.json({ ok: true });
        });
    }
    app.post('/api/admin/cleanup-probe', (c) => c.json({ ok: true }));
    return { app, hit };
}

describe('origin policy', () => {
    beforeEach(() => {
        vi.stubEnv('WEB_ORIGIN', `${WEB}, https://www.motonui.app`);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('CORS', () => {
        it('does not allow an unknown origin, on preflight or on the request', async () => {
            const app = createApp();
            const preflight = await app.request('/api/health', {
                method: 'OPTIONS',
                headers: { origin: EVIL, 'access-control-request-method': 'POST' },
            });
            const get = await app.request('/api/health', { headers: { origin: EVIL } });

            expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
            expect(get.headers.get('access-control-allow-origin')).toBeNull();
        });

        it.each([WEB, 'https://www.motonui.app'])('allows the configured origin %s with credentials', async (origin) => {
            const res = await createApp().request('/api/health', { headers: { origin } });

            expect(res.headers.get('access-control-allow-origin')).toBe(origin);
            expect(res.headers.get('access-control-allow-credentials')).toBe('true');
        });

        it('allows nothing when WEB_ORIGIN is not set outside development', async () => {
            vi.stubEnv('WEB_ORIGIN', '');
            const res = await createApp().request('/api/health', { headers: { origin: WEB } });
            expect(res.headers.get('access-control-allow-origin')).toBeNull();
        });
    });

    describe('cross-site writes', () => {
        it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s from another site before the handler runs', async (method) => {
            const { app, hit } = appWithProbes();
            const res = await app.request('/api/__write', { method, headers: { origin: EVIL } });

            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({ code: 'CROSS_SITE_REQUEST', status: 403 });
            expect(hit).not.toHaveBeenCalled();
        });

        it('rejects a write that browsers mark as cross-site even without an Origin header', async () => {
            const { app, hit } = appWithProbes();
            const res = await app.request('/api/__write', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } });

            expect(res.status).toBe(403);
            expect(hit).not.toHaveBeenCalled();
        });

        it.each([
            ['the web app', { origin: WEB }],
            ['the API own origin', { origin: 'http://localhost' }],
            ['a client that sends no Origin (mobile, server to server)', {}],
        ])('lets a write from %s through', async (_label, headers) => {
            const { app, hit } = appWithProbes();
            const res = await app.request('/api/__write', { method: 'POST', headers: headers as Record<string, string> });

            expect(res.status).toBe(200);
            expect(hit).toHaveBeenCalledTimes(1);
        });

        it('does not block reads from another site (CORS already hides the response)', async () => {
            const res = await createApp().request('/api/health', { headers: { origin: EVIL } });
            expect(res.status).toBe(200);
        });

        it.each(['/api/admin/cleanup', '/api/admin/send-reminders'])('leaves the cron route %s to its own secret', async (path) => {
            const res = await createApp().request(path, { method: 'POST', headers: { origin: EVIL } });
            expect(res.status).not.toBe(403);
        });
    });

    describe('caching', () => {
        it('marks API responses private, no-store', async () => {
            const res = await createApp().request('/api/health');
            expect(res.headers.get('cache-control')).toBe('private, no-store');
        });

        it('marks error responses too', async () => {
            const res = await createApp().request('/api/trips');
            expect(res.status).toBe(401);
            expect(res.headers.get('cache-control')).toBe('private, no-store');
        });

        it('leaves the public post route cacheable', async () => {
            // No Supabase here: an unreachable one makes postgrest-js retry the read for ~7 s.
            vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
            const res = await createApp().request('/api/posts/some-slug');
            expect(res.headers.get('cache-control')).not.toBe('private, no-store');
        });
    });
});
