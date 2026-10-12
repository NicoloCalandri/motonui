import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Partner invites and self-service account deletion: counterpart of
 * src/app/api/trips/[id]/invites/**, src/app/api/invites/accept and
 * src/app/api/account/delete. The database functions hold the rules; these
 * tests pin what the API sends them and what it gives back.
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const INVITE = '50000000-0000-4000-8000-00000000000f';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'Nicolo@Example.com' };
const TOKEN = 'A'.repeat(43);

type Rpc = { fn: string; args: Record<string, unknown> | undefined; admin: boolean };

const state = vi.hoisted(() => ({
    rpcs: [] as Array<{ fn: string; args: Record<string, unknown> | undefined; admin: boolean }>,
    rpcResult: {} as Record<string, { data: unknown; error: { message: string } | null }>,
    rows: {} as Record<string, Record<string, unknown> | null>,
    deletes: [] as string[],
}));
const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), drain: vi.fn() }));

function stubClient(admin: boolean) {
    const builder = (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
        chain.delete = () => {
            state.deletes.push(table);
            return chain;
        };
        const guard = { id: INVITE, trip_id: TRIP, user_id: USER.id, owner_id: USER.id, role: 'user', suspended_at: null, title: 'Rapa Nui', destination: 'Cile' };
        const row = () => (table in state.rows ? state.rows[table] : guard);
        chain.single = async () => ({ data: row(), error: null });
        chain.maybeSingle = async () => ({ data: row(), error: null });
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: row() ? [row()] : [], error: null }).then(resolve);
        return chain;
    };
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: builder,
        rpc: async (fn: string, args?: Record<string, unknown>) => {
            if (fn === 'check_rate_limit') return { data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null };
            state.rpcs.push({ fn, args, admin });
            return state.rpcResult[fn] ?? { data: null, error: null };
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(false),
    createAnonClient: () => stubClient(false),
    createAdminClient: () => stubClient(true),
}));
vi.mock('../lib/email', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/email')>()),
    sendEmail: mocks.sendEmail,
}));
vi.mock('../lib/storage-deletion', () => ({ drainStorageDeletionQueue: mocks.drain }));

import { createApp } from '../app';

function call(method: string, path: string, body?: Record<string, unknown>) {
    const headers: Record<string, string> = { authorization: 'Bearer test-token' };
    const init: RequestInit = { method, headers };
    if (body) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    return createApp().request(path, init);
}

const rpc = (fn: string): Rpc[] => state.rpcs.filter((entry) => entry.fn === fn);

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://motonui.app');
    state.rpcs = [];
    state.rows = {};
    state.deletes = [];
    state.rpcResult = {
        create_trip_invite: { data: { id: INVITE, email: 'giorgia@example.com', expires_at: '2026-10-20T00:00:00Z' }, error: null },
        accept_trip_invite: { data: TRIP, error: null },
        delete_my_account: { data: { transferred_trips: 1 }, error: null },
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/trips/:id/invites', () => {
    const path = `/api/trips/${TRIP}/invites`;

    it('stores only the hash of the token and returns the link', async () => {
        const res = await call('POST', path, { email: ' Giorgia@Example.com ' });

        expect(res.status).toBe(201);
        const body = (await res.json()) as { invite_url: string; email_sent: boolean; invite: Record<string, unknown> };
        const token = body.invite_url.replace('https://motonui.app/invite/', '');
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

        const [{ args }] = rpc('create_trip_invite');
        expect(args).toEqual({ p_trip_id: TRIP, p_email: 'giorgia@example.com', p_token_hash: createHash('sha256').update(token).digest('hex') });
        expect(JSON.stringify(args)).not.toContain(token);
        expect(body.email_sent).toBe(true);
        expect(body.invite).toEqual({ id: INVITE, email: 'giorgia@example.com', expires_at: '2026-10-20T00:00:00Z' });
    });

    it('refuses to invite oneself, whatever the letter case', async () => {
        const res = await call('POST', path, { email: 'nicolo@example.com' });

        expect(res.status).toBe(400);
        expect(rpc('create_trip_invite')).toEqual([]);
    });

    it('refuses an invalid address', async () => {
        const res = await call('POST', path, { email: 'not-an-email' });

        expect(res.status).toBe(400);
        expect(rpc('create_trip_invite')).toEqual([]);
    });

    it('still creates the invite when the email cannot be sent', async () => {
        mocks.sendEmail.mockRejectedValue(new Error('smtp down'));

        const res = await call('POST', path, { email: 'giorgia@example.com' });

        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({ email_sent: false });
    });

    it('says the email was not sent when no provider is configured', async () => {
        vi.stubEnv('RESEND_API_KEY', '');

        const res = await call('POST', path, { email: 'giorgia@example.com' });

        expect(await res.json()).toMatchObject({ email_sent: false });
    });

    it.each([
        ['TRIP_FULL: two members', 409, 'TRIP_FULL'],
        ['FORBIDDEN: not the owner', 403, 'FORBIDDEN'],
    ])('maps the database refusal %s', async (message, status, code) => {
        state.rpcResult.create_trip_invite = { data: null, error: { message } };

        const res = await call('POST', path, { email: 'giorgia@example.com' });

        expect(res.status).toBe(status);
        expect(await res.json()).toMatchObject({ code });
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('hides an unexpected database error', async () => {
        state.rpcResult.create_trip_invite = { data: null, error: { message: 'relation "secret_table" does not exist' } };

        const res = await call('POST', path, { email: 'giorgia@example.com' });

        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain('secret_table');
    });
});

describe('invites of a trip', () => {
    it('lists them without the token hash', async () => {
        state.rows.trip_invites = { id: INVITE, email: 'giorgia@example.com', accepted_at: null };

        const res = await call('GET', `/api/trips/${TRIP}/invites`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([state.rows.trip_invites]);
    });

    it('revokes a pending invite', async () => {
        const res = await call('DELETE', `/api/trips/${TRIP}/invites/${INVITE}`);

        expect(res.status).toBe(200);
        expect(state.deletes).toEqual(['trip_invites']);
    });

    it('answers 404 when the database deleted nothing', async () => {
        state.rows.trip_invites = null;

        const res = await call('DELETE', `/api/trips/${TRIP}/invites/${INVITE}`);

        expect(res.status).toBe(404);
    });
});

describe('POST /api/invites/accept', () => {
    it('joins the trip with the caller’s own session', async () => {
        const res = await call('POST', '/api/invites/accept', { token: TOKEN });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ trip_id: TRIP });
        expect(rpc('accept_trip_invite')).toEqual([{ fn: 'accept_trip_invite', args: { p_token: TOKEN }, admin: false }]);
    });

    it.each(['short', `${'A'.repeat(42)}!`, 'A'.repeat(44)])('refuses the malformed token %s without asking the database', async (token) => {
        const res = await call('POST', '/api/invites/accept', { token });

        expect(res.status).toBe(400);
        expect(rpc('accept_trip_invite')).toEqual([]);
    });

    it.each([
        ['INVITE_INVALID', 404],
        ['INVITE_EMAIL_MISMATCH', 403],
        ['TRIP_FULL', 409],
    ])('maps the database refusal %s', async (code, status) => {
        state.rpcResult.accept_trip_invite = { data: null, error: { message: `${code}: details` } };

        const res = await call('POST', '/api/invites/accept', { token: TOKEN });

        expect(res.status).toBe(status);
        expect(await res.json()).toMatchObject({ code });
    });

    it('requires a session', async () => {
        const res = await createApp().request('/api/invites/accept', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }),
        });

        expect(res.status).toBe(401);
        expect(rpc('accept_trip_invite')).toEqual([]);
    });
});

describe('POST /api/account/delete', () => {
    it('deletes the account with the caller’s session and drains the file queue', async () => {
        const res = await call('POST', '/api/account/delete', { confirm: 'ELIMINA' });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ deleted: true, transferred_trips: 1 });
        expect(rpc('delete_my_account')).toEqual([{ fn: 'delete_my_account', args: { confirm_text: 'DELETE' }, admin: false }]);
        expect(mocks.drain).toHaveBeenCalledTimes(1);
    });

    it.each([{}, { confirm: 'elimina' }, { confirm: 'DELETE' }])('refuses %j and deletes nothing', async (body) => {
        const res = await call('POST', '/api/account/delete', body);

        expect(res.status).toBe(400);
        expect(rpc('delete_my_account')).toEqual([]);
    });

    it('answers a friendly error when the deletion fails, without draining', async () => {
        state.rpcResult.delete_my_account = { data: null, error: { message: 'relation "secret_table" does not exist' } };

        const res = await call('POST', '/api/account/delete', { confirm: 'ELIMINA' });

        expect(res.status).toBe(500);
        const text = await res.text();
        expect(text).not.toContain('secret_table');
        expect(JSON.parse(text)).toMatchObject({ code: 'ACCOUNT_DELETE_FAILED' });
        expect(mocks.drain).not.toHaveBeenCalled();
    });

    it('still succeeds when the files cannot be removed right away', async () => {
        mocks.drain.mockRejectedValue(new Error('storage down'));

        const res = await call('POST', '/api/account/delete', { confirm: 'ELIMINA' });

        expect(res.status).toBe(200);
    });

    it('requires a session', async () => {
        const res = await createApp().request('/api/account/delete', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'ELIMINA' }),
        });

        expect(res.status).toBe(401);
        expect(rpc('delete_my_account')).toEqual([]);
    });
});
