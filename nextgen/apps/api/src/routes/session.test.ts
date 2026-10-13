import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GET /api/session — what the web app needs to know about the signed-in user
 * before it draws anything: name, avatar, role, and whether the account is
 * suspended (and why). The Next.js app gets all of this on the server, in its
 * middleware and layouts; the SPA has to ask.
 */

const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'giorgia@example.com' };

const state = vi.hoisted(() => ({
    profile: null as Record<string, unknown> | null,
    columns: [] as string[],
    error: null as null | { message: string },
}));

function stubClient() {
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: () => {
            const chain: Record<string, unknown> = {};
            chain.select = (columns: string) => {
                state.columns.push(columns);
                return chain;
            };
            chain.eq = () => chain;
            chain.single = async () => ({ data: state.profile, error: state.error });
            chain.maybeSingle = chain.single;
            return chain;
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';

const get = (headers: Record<string, string> = { authorization: 'Bearer test-token' }) => createApp().request('/api/session', { headers });

beforeEach(() => {
    state.columns = [];
    state.error = null;
    state.profile = { display_name: 'Giorgia', avatar_url: null, role: 'user', suspended_at: null, suspended_reason: null };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/session', () => {
    it('returns the identity, the role and the suspension of the caller', async () => {
        const res = await get();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            id: USER.id, email: USER.email, display_name: 'Giorgia', avatar_url: null,
            role: 'user', suspended_at: null, suspended_reason: null,
        });
    });

    it('answers a suspended user too, with the reason: the page that tells them needs it', async () => {
        state.profile = { display_name: 'Giorgia', avatar_url: null, role: 'user', suspended_at: '2026-10-01T00:00:00Z', suspended_reason: 'Verifica in corso' };

        const res = await get();

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ suspended_at: '2026-10-01T00:00:00Z', suspended_reason: 'Verifica in corso' });
    });

    it('reads only the columns it returns', async () => {
        await get();

        expect(state.columns).toEqual(['display_name, avatar_url, role, suspended_at, suspended_reason']);
    });

    it('requires a session', async () => {
        const res = await get({});

        expect(res.status).toBe(401);
        expect(state.columns).toEqual([]);
    });

    it('treats a missing profile row as a plain user, never as an admin', async () => {
        state.profile = null;

        const res = await get();

        expect(await res.json()).toMatchObject({ role: 'user', suspended_at: null, display_name: null });
    });

    it('answers 500 without the database message when the profile cannot be read', async () => {
        state.profile = null;
        state.error = { message: 'relation "secret_table" does not exist' };

        const res = await get();

        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain('secret_table');
    });

    it('is never cached', async () => {
        const res = await get();

        expect(res.headers.get('cache-control')).toContain('no-store');
    });
});
