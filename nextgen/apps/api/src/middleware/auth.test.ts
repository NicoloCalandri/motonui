import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

// A malformed/invalid token still reaches supabase.auth.getUser() over the
// network; mock it out so the test exercises requireUser's own logic only.
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ auth: { getUser } }),
}));

const { requireUser } = await import('./auth');

describe('requireUser middleware', () => {
    beforeEach(() => {
        getUser.mockResolvedValue({ data: { user: null }, error: null });
    });

    it('returns 401 when no Authorization header is present', async () => {
        const app = new Hono<AppEnv>();
        app.get('/protected', requireUser, (c) => c.json({ ok: true }));

        const res = await app.request('/protected');

        expect(res.status).toBe(401);
        const body = (await res.json()) as { code: string };
        expect(body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for a malformed Authorization header', async () => {
        const app = new Hono<AppEnv>();
        app.get('/protected', requireUser, (c) => c.json({ ok: true }));

        const res = await app.request('/protected', {
            headers: { Authorization: 'NotBearer something' },
        });

        // The token is never a valid Supabase JWT, so auth.getUser() resolves
        // with no user regardless of header shape — still 401.
        expect(res.status).toBe(401);
    });

    describe('when Supabase Auth cannot decide', () => {
        const ask = async () => {
            const app = new Hono<AppEnv>();
            app.get('/protected', requireUser, (c) => c.json({ ok: true }));
            return app.request('/protected', { headers: { Authorization: 'Bearer some-token' } });
        };

        it.each([
            ['a network failure', { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }],
            ['a server error', { name: 'AuthApiError', status: 502, message: 'bad gateway' }],
        ])('answers 503, not 401, on %s', async (_label, error) => {
            getUser.mockResolvedValue({ data: { user: null }, error });

            const res = await ask();

            expect(res.status).toBe(503);
            expect(await res.json()).toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 });
        });

        it('answers 503 when the call throws', async () => {
            getUser.mockRejectedValue(new TypeError('fetch failed'));

            expect((await ask()).status).toBe(503);
        });

        it('still answers 401 for a token Supabase rejects', async () => {
            getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } });

            expect((await ask()).status).toBe(401);
        });
    });
});
