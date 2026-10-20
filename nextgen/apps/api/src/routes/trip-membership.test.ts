import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Routes outside /api/trips/:id that still act on a trip: the central guard
 * does not see them, so each one checks membership itself. Here the caller
 * is signed in but belongs to no trip, and the database would let the query
 * through: the route has to refuse on its own (RLS stays the first boundary).
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const EXPENSE = '30000000-0000-4000-8000-00000000000d';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };

const state = vi.hoisted(() => ({ writes: [] as string[] }));

function stubClient() {
    const rows: Record<string, unknown> = {
        // The expense exists and belongs to a trip the caller is not in.
        expenses: { id: EXPENSE, trip_id: TRIP, amount: 1000, currency: 'EUR', paid_by: 'someone-else' },
        profiles: { role: 'user', suspended_at: null },
        trips: { id: TRIP, owner_id: 'someone-else', title: 'x', days: [], expenses: [] },
    };
    const builder = (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'insert', 'update', 'upsert', 'delete']) {
            chain[method] = () => {
                if (['insert', 'update', 'upsert', 'delete'].includes(method)) state.writes.push(`${table}.${method}`);
                return chain;
            };
        }
        const one = async () => ({ data: rows[table] ?? null, error: null });
        chain.single = one;
        chain.maybeSingle = one;
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
        return chain;
    };
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: builder,
        rpc: async (fn: string) => {
            if (fn !== 'check_rate_limit') state.writes.push(`rpc.${fn}`);
            return { data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null };
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';

function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { authorization: 'Bearer test-token' };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    return createApp().request(path, init);
}

describe('trip membership outside /api/trips/:id', () => {
    beforeEach(() => {
        state.writes = [];
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it.each([
        ['PUT', `/api/expenses/${EXPENSE}`, { description: 'cena' }],
        ['DELETE', `/api/expenses/${EXPENSE}`, undefined],
        ['POST', '/api/ai/generate-post', { tripId: TRIP }],
    ])('%s %s refuses a caller who is not in the trip, and changes nothing', async (method, path, body) => {
        const res = await call(method, path, body);

        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: 'FORBIDDEN', status: 403 });
        // No row touched, and no AI quota consumed on the caller's behalf.
        expect(state.writes).toEqual([]);
    });
});
