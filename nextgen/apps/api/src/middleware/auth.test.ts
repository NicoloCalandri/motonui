import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

// A malformed/invalid token still reaches supabase.auth.getUser() over the
// network; mock it out so the test exercises requireUser's own logic only.
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    }),
}));

const { requireUser } = await import('./auth');

describe('requireUser middleware', () => {
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
});
