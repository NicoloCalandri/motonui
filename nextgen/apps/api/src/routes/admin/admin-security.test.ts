import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Admin actions that touch other people's sessions and data: impersonation
 * tokens are stored hashed and revoked on exit, a deleted user goes through
 * the same purge as a self-service deletion, and the development bypass
 * never works in production.
 */

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.com' };
const TARGET = '10000000-0000-4000-8000-00000000000a';

type Write = { table: string; op: string; payload?: Record<string, unknown>; filters: Array<[string, unknown]> };

const state = vi.hoisted(() => ({
    role: 'admin',
    writes: [] as Array<{ table: string; op: string; payload?: Record<string, unknown>; filters: Array<[string, unknown]> }>,
    events: [] as string[],
    purgeError: null as null | { message: string },
}));
const mocks = vi.hoisted(() => ({ drain: vi.fn() }));

function stubClient() {
    const builder = (table: string) => {
        let write: Write | null = null;
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'order', 'limit']) chain[method] = () => chain;
        chain.eq = (column: string, value: unknown) => {
            write?.filters.push([column, value]);
            return chain;
        };
        for (const op of ['insert', 'update', 'delete']) {
            chain[op] = (payload?: Record<string, unknown>) => {
                write = { table, op, payload, filters: [] };
                state.writes.push(write);
                return chain;
            };
        }
        const row = { id: TARGET, display_name: 'Giorgia', email: 'giorgia@example.com', role: state.role, suspended_at: null };
        chain.single = async () => ({ data: row, error: null });
        chain.maybeSingle = async () => ({ data: row, error: null });
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve);
        return chain;
    };
    return {
        auth: {
            getUser: async () => ({ data: { user: ADMIN } }),
            admin: {
                deleteUser: async () => {
                    state.events.push('deleteUser');
                    return { error: null };
                },
            },
        },
        from: builder,
        rpc: async (fn: string, args?: Record<string, unknown>) => {
            if (fn === 'purge_user_data') {
                state.events.push(`purge:${String(args?.p_user)}`);
                return { data: null, error: state.purgeError };
            }
            return { data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null };
        },
    };
}

vi.mock('../../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));
vi.mock('../../lib/storage-deletion', () => ({
    drainStorageDeletionQueue: async (...args: unknown[]) => {
        state.events.push('drain');
        return mocks.drain(...args);
    },
}));

import { createApp } from '../../app';

function call(method: string, path: string, options: { body?: Record<string, unknown>; cookie?: string } = {}) {
    const headers: Record<string, string> = { authorization: 'Bearer test-token' };
    const init: RequestInit = { method, headers };
    if (options.cookie) headers.cookie = options.cookie;
    if (options.body) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }
    return createApp().request(path, init);
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenCookie = (res: Response) => /impersonation_token=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? '';

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    state.role = 'admin';
    state.writes = [];
    state.events = [];
    state.purgeError = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('impersonation tokens', () => {
    it('stores the hash of the token id, never the token', async () => {
        const res = await call('POST', `/api/admin/users/${TARGET}/impersonate`);

        expect(res.status).toBe(200);
        const token = tokenCookie(res);
        const stored = state.writes.find((write) => write.table === 'impersonation_tokens' && write.op === 'insert');
        expect(stored?.payload?.token).toBe(sha256(String(decodeJwt(token).jti)));
        expect(JSON.stringify(state.writes)).not.toContain(token);
        expect(stored?.payload).toMatchObject({ admin_id: ADMIN.id, target_id: TARGET });
    });

    it('sets the token as an httpOnly cookie', async () => {
        const res = await call('POST', `/api/admin/users/${TARGET}/impersonate`);

        const cookie = (res.headers.get('set-cookie') ?? '').split(/,(?=\s*impersonation_)/).find((part) => part.includes('impersonation_token=')) ?? '';
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('revokes the stored token on exit', async () => {
        const token = tokenCookie(await call('POST', `/api/admin/users/${TARGET}/impersonate`));
        state.writes = [];

        const res = await call('POST', '/api/admin/impersonate/exit', { cookie: `impersonation_token=${token}` });

        expect(res.status).toBe(200);
        const revoked = state.writes.find((write) => write.table === 'impersonation_tokens' && write.op === 'delete');
        expect(revoked?.filters).toEqual([['token', sha256(String(decodeJwt(token).jti))]]);
    });
});

describe('DELETE /api/admin/users/:id', () => {
    const remove = () => call('DELETE', `/api/admin/users/${TARGET}`, { body: { confirmEmail: 'giorgia@example.com' } });

    it('purges the user data before deleting the account, then removes the queued files', async () => {
        const res = await remove();

        expect(res.status).toBe(200);
        expect(state.events).toEqual([`purge:${TARGET}`, 'deleteUser', 'drain']);
    });

    it('does not delete the account when the purge fails', async () => {
        state.purgeError = { message: 'relation "secret_table" does not exist' };

        const res = await remove();

        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain('secret_table');
        expect(state.events).toEqual([`purge:${TARGET}`]);
    });

    it('still succeeds when the files cannot be removed right away', async () => {
        mocks.drain.mockRejectedValue(new Error('storage down'));

        expect((await remove()).status).toBe(200);
    });
});

describe('ADMIN_AUTH_BYPASS', () => {
    it('never lets a non-admin through in production', async () => {
        state.role = 'user';
        vi.stubEnv('ADMIN_AUTH_BYPASS', 'true');
        vi.stubEnv('NODE_ENV', 'production');

        const res = await call('GET', '/api/admin/stats');

        expect(res.status).toBe(403);
    });

    it('lets a developer through outside production', async () => {
        state.role = 'user';
        vi.stubEnv('ADMIN_AUTH_BYPASS', 'true');
        vi.stubEnv('NODE_ENV', 'development');

        const res = await call('GET', '/api/admin/stats');

        expect(res.status).not.toBe(403);
    });
});
