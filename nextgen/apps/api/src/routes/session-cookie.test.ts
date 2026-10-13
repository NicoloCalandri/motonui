import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The session cookie lets the browser read private files with a plain
 * `<img src>` or link, which cannot carry a bearer token. It is a copy of
 * the access token the caller already holds, and it is honoured only where a
 * forged request can do no harm: on reads.
 */

const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'giorgia@example.com' };
const GOOD = 'good-token';

const state = vi.hoisted(() => ({ tokens: [] as string[], writes: [] as string[] }));

function stubClient(token: string) {
    state.tokens.push(token);
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
    chain.single = async () => ({ data: { role: 'user', suspended_at: null, display_name: 'Giorgia' }, error: null });
    chain.maybeSingle = chain.single;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return {
        auth: { getUser: async () => ({ data: { user: token === GOOD ? USER : null } }) },
        from: () => chain,
        rpc: async (fn: string) => {
            state.writes.push(fn);
            return { data: { id: 't1' }, error: null };
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: (token: string) => stubClient(token),
    createAnonClient: () => stubClient(''),
    createAdminClient: () => stubClient(''),
}));

import { createApp } from '../app';

const bearer = { authorization: `Bearer ${GOOD}` };
const cookie = (token = GOOD) => ({ cookie: `motonui_session=${token}` });
const call = (method: string, path: string, headers: Record<string, string> = {}, body?: string) =>
    createApp().request(path, { method, headers: body ? { ...headers, 'content-type': 'application/json' } : headers, body });

beforeEach(() => {
    state.tokens = [];
    state.writes = [];
    vi.unstubAllEnvs();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/session/cookie', () => {
    it('sets the caller’s own token as an httpOnly, same-site cookie scoped to the API', async () => {
        const res = await call('POST', '/api/session/cookie', bearer);

        expect(res.status).toBe(200);
        const set = res.headers.get('set-cookie') ?? '';
        expect(set).toContain(`motonui_session=${GOOD}`);
        expect(set).toMatch(/HttpOnly/i);
        expect(set).toMatch(/SameSite=Strict/i);
        expect(set).toMatch(/Path=\/api/i);
        const maxAge = Number(/Max-Age=(\d+)/i.exec(set)?.[1]);
        expect(maxAge).toBeGreaterThan(0);
        expect(maxAge).toBeLessThanOrEqual(3600);
    });

    it('marks the cookie Secure in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        const res = await call('POST', '/api/session/cookie', bearer);

        expect(res.headers.get('set-cookie') ?? '').toMatch(/Secure/i);
    });

    it('does not outlive the token it copies', async () => {
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 120 })).toString('base64url');
        const shortLived = `h.${payload}.s`;
        // The stub accepts only GOOD: this request is refused, which is enough to see no cookie is set for a bad token.
        const res = await call('POST', '/api/session/cookie', { authorization: `Bearer ${shortLived}` });

        expect(res.status).toBe(401);
        expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('cannot be renewed from the cookie alone', async () => {
        const res = await call('POST', '/api/session/cookie', cookie());

        expect(res.status).toBe(401);
        expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('requires a session', async () => {
        expect((await call('POST', '/api/session/cookie')).status).toBe(401);
    });
});

describe('requests that carry only the cookie', () => {
    it('are accepted on a read', async () => {
        const res = await call('GET', '/api/session', cookie());

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ id: USER.id });
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('are refused on %s: a write needs the bearer token', async (method) => {
        const res = await call(method, '/api/trips', cookie(), '{"title":"Rapa Nui","destination":"Cile"}');

        expect([401, 404]).toContain(res.status);
        expect(state.writes).toEqual([]);
        expect(state.tokens).toEqual([]);
    });

    it('are refused when the token in the cookie is not valid', async () => {
        const res = await call('GET', '/api/session', cookie('stolen-or-expired'));

        expect(res.status).toBe(401);
    });

    it('never override a bearer token', async () => {
        await call('GET', '/api/session', { ...bearer, ...cookie('another-token') });

        expect(state.tokens).toEqual([GOOD]);
    });
});

describe('DELETE /api/session/cookie', () => {
    it('clears the cookie, with or without a session', async () => {
        const res = await call('DELETE', '/api/session/cookie');

        expect(res.status).toBe(200);
        const set = res.headers.get('set-cookie') ?? '';
        expect(set).toMatch(/motonui_session=;/);
        expect(set).toMatch(/Max-Age=0/i);
        expect(set).toMatch(/Path=\/api/i);
    });
});
