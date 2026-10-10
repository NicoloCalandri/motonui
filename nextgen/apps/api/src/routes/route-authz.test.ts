import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every route under /api/trips/:id must refuse a caller who is not a member
 * of that trip, whatever its handler does (port of the invariant checked by
 * src/app/api/trips/route-authz.test.ts). The routes are read from the app
 * itself, so a router added later is covered without touching this file.
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const OTHER = '20000000-0000-4000-8000-00000000000b';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };

const state = vi.hoisted(() => ({ user: null as { id: string; email: string } | null, tables: [] as string[] }));

/** A Supabase stub in which the caller belongs to no trip and owns none. */
function stubClient() {
    const chain: Record<string, unknown> = {};
    const result = { data: null, error: null };
    for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'is', 'order', 'limit', 'range', 'gte', 'lte']) {
        chain[method] = () => chain;
    }
    chain.single = async () => result;
    chain.maybeSingle = async () => result;
    chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    return {
        auth: { getUser: async () => ({ data: { user: state.user } }) },
        from: (table: string) => {
            state.tables.push(table);
            return chain;
        },
        rpc: async () => result,
        storage: { from: () => ({}) },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function tripRoutes(): Array<[string, string]> {
    const seen = new Set<string>();
    for (const route of createApp().routes) {
        if (!METHODS.has(route.method)) continue;
        if (route.path !== '/api/trips/:id' && !route.path.startsWith('/api/trips/:id/')) continue;
        if (route.path.endsWith('*')) continue;
        seen.add(`${route.method} ${route.path}`);
    }
    return [...seen].sort().map((entry) => entry.split(' ') as [string, string]);
}

function request(method: string, path: string, tripId: string, token: boolean) {
    const url = path.replace(':id', tripId).replace(/:[A-Za-z]+/g, OTHER);
    const headers: Record<string, string> = {};
    if (token) headers.authorization = 'Bearer test-token';
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'DELETE') {
        headers['content-type'] = 'application/json';
        init.body = '{}';
    }
    return createApp().request(url, init);
}

const ROUTES = tripRoutes();

describe('authorization of /api/trips/:id/**', () => {
    beforeEach(() => {
        state.user = USER;
        state.tables = [];
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('finds the trip routes, including the ones whose handler never checked membership', () => {
        const names = ROUTES.map(([method, path]) => `${method} ${path}`);
        expect(names.length).toBeGreaterThan(40);
        expect(names).toContain('GET /api/trips/:id/days');
        expect(names).toContain('POST /api/trips/:id/days');
        expect(names).toContain('GET /api/trips/:id');
    });

    describe.each(ROUTES)('%s %s', (method, path) => {
        it('answers 403 to a signed-in user who is not a member', async () => {
            const res = await request(method, path, TRIP, true);
            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' });
        });

        it('answers 401 without a session', async () => {
            const res = await request(method, path, TRIP, false);
            expect(res.status).toBe(401);
        });

        it('answers 400 for a trip id that is not a UUID, without touching the database', async () => {
            const res = await request(method, path, 'not-a-uuid', true);
            expect(res.status).toBe(400);
            expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
            expect(state.tables).toEqual([]);
        });
    });
});
