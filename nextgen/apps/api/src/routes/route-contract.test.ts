import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Input contract of the whole API, read from the app's own route table (the
 * Hono counterpart of src/app/api/trips/route-contract.test.ts): bad ids and
 * bad bodies give a standard 400 and never a write; no error body carries a
 * database message.
 */

const UUID = '10000000-0000-4000-8000-00000000000a';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };
const DB_ERROR = 'relation "secret_table" does not exist';
const WRITES = ['insert', 'update', 'upsert', 'delete'];
// Queried by the guards before a handler runs: they must keep answering for the handler to be reached.
const GUARD_TABLES = new Set(['trip_members', 'trips', 'profiles']);

const state = vi.hoisted(() => ({ writes: [] as string[], failHandlers: false }));

/** The caller is signed in, admin, and a member and owner of every trip. */
function stubClient() {
    const row = { id: UUID, trip_id: UUID, user_id: USER.id, owner_id: USER.id, paid_by: USER.id, author_id: USER.id, role: 'admin', suspended_at: null };
    const failure = { data: null, error: { message: DB_ERROR } };
    const builder = (table: string) => {
        let wrote = false;
        // In failure mode the guards' reads keep working, so the handler is
        // reached; everything the handler does (other tables, any write) fails.
        const failing = () => state.failHandlers && (wrote || !GUARD_TABLES.has(table));
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'ilike', 'order', 'limit', 'range', 'gte', 'lte', 'gt', 'lt', ...WRITES]) {
            chain[method] = () => {
                if (WRITES.includes(method)) {
                    wrote = true;
                    state.writes.push(`${table}.${method}`);
                }
                return chain;
            };
        }
        const one = async () => (failing() ? failure : { data: row, error: null });
        chain.single = one;
        chain.maybeSingle = one;
        chain.then = (resolve: (value: unknown) => unknown) =>
            Promise.resolve(failing() ? failure : { data: [row], error: null, count: 1 }).then(resolve);
        return chain;
    };
    return {
        auth: {
            getUser: async () => ({ data: { user: USER } }),
            admin: new Proxy({}, {
                get: () => async () => {
                    state.writes.push('auth.admin');
                    return state.failHandlers ? failure : { data: { user: USER, users: [] }, error: null };
                },
            }),
        },
        from: builder,
        rpc: async (fn: string) => {
            if (fn !== 'check_rate_limit') state.writes.push(`rpc.${fn}`);
            return { data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null };
        },
        storage: { from: () => new Proxy({}, { get: () => async () => { state.writes.push('storage'); return { data: null, error: null }; } }) },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';

type Route = { method: string; path: string };

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ID_PARAM = /:(id|[A-Za-z]+Id)\b/g;
// Called by a scheduler with its own secret and no body.
const CRON = new Set(['/api/admin/cleanup', '/api/admin/send-reminders']);

function routes(): Route[] {
    const seen = new Map<string, Route>();
    for (const { method, path } of createApp().routes) {
        if (METHODS.has(method) && !path.endsWith('*') && !CRON.has(path)) seen.set(`${method} ${path}`, { method, path });
    }
    return [...seen.values()].sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

function url(path: string, badParam?: string): string {
    return path
        .replace(ID_PARAM, (match, name: string) => (name === badParam ? 'abc' : UUID))
        .replace(/:[A-Za-z]+/g, 'some-slug');
}

function send(route: Route, target: string, body?: string) {
    const headers: Record<string, string> = { authorization: 'Bearer test-token' };
    const init: RequestInit = { method: route.method, headers };
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
        init.body = body;
    }
    return createApp().request(target, init);
}

async function expectStandardError(res: Response, status: number) {
    const text = await res.text();
    expect(`${res.status} ${text}`).toMatch(new RegExp(`^${status} `));
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['code', 'error', 'status']);
    expect(body.status).toBe(status);
    expect(typeof body.error).toBe('string');
    return body;
}

/**
 * Write routes that take no body: the action is fully described by the path
 * and the caller. A body sent to them is ignored, so the bad-body cases do
 * not apply. Listed explicitly so that a new write route is checked by default.
 */
const BODYLESS = new Set([
    'POST /api/admin/impersonate/exit',
    'POST /api/session/cookie',
    'POST /api/admin/users/:id/impersonate',
    'POST /api/admin/users/:id/unsuspend',
    'POST /api/trips/:id/packing',
]);

const ALL = routes();
const WITH_IDS = ALL.flatMap((route) => [...route.path.matchAll(ID_PARAM)].map((match) => [route.method, route.path, match[1]] as const));
const WRITE_ROUTES = ALL
    .filter((route) => route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH')
    .filter((route) => !BODYLESS.has(`${route.method} ${route.path}`));

const BAD_BODIES: Array<[string, string]> = [
    ['malformed JSON', '{"title": '],
    ['an array', '[]'],
    ['a string', '"x"'],
    ['null', 'null'],
    ['a number', '42'],
];

beforeEach(() => {
    state.writes = [];
    state.failHandlers = false;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('path parameters', () => {
    it('finds routes with id parameters', () => {
        expect(WITH_IDS.length).toBeGreaterThan(60);
    });

    it.each(WITH_IDS)('%s %s answers 400 when :%s is not a UUID', async (method, path, param) => {
        const route = { method, path };
        const res = await send(route, url(path, param), method === 'GET' || method === 'DELETE' ? undefined : '{}');

        const body = await expectStandardError(res, 400);
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(state.writes).toEqual([]);
    });
});

describe('request bodies', () => {
    it('finds the write routes', () => {
        expect(WRITE_ROUTES.length).toBeGreaterThan(35);
    });

    it('lists as bodyless only routes that exist', () => {
        const names = new Set(ALL.map((route) => `${route.method} ${route.path}`));
        expect([...BODYLESS].filter((name) => !names.has(name))).toEqual([]);
    });

    describe.each(WRITE_ROUTES.map((route) => [route.method, route.path] as const))('%s %s', (method, path) => {
        it.each(BAD_BODIES)('answers 400 to %s and writes nothing', async (_label, body) => {
            const res = await send({ method, path }, url(path), body);

            await expectStandardError(res, 400);
            expect(state.writes).toEqual([]);
        });
    });
});

/**
 * Bodies that pass validation, for routes whose database call is reached only
 * with valid input. Without an entry the route gets `{}` (enough when every
 * field is optional, or when the failure comes before the body is used).
 */
const VALID_BODIES: Record<string, unknown> = {
    'PATCH /api/admin/trips/:id': { status: 'archived' },
    'POST /api/admin/users': { email: 'new@example.com', password: 'a-long-password-1' },
    'PUT /api/admin/users/:id': { displayName: 'Nome' },
    'POST /api/admin/users/:id/suspend': { reason: 'motivo' },
};

describe('error bodies', () => {
    /**
     * The request-based check below reaches a handler's database call only
     * where `{}` or an entry of VALID_BODIES passes validation: most write
     * routes stop at 400 first. This source check covers the rest: no route
     * file may build a response from an error's message.
     */
    it('no route builds a response from an error message', () => {
        const dir = join(process.cwd(), 'src', 'routes');
        const files = (current: string): string[] => readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
            const path = join(current, entry.name);
            if (entry.isDirectory()) return files(path);
            return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
        });
        const offenders = files(dir).flatMap((file) =>
            readFileSync(file, 'utf8').split('\n')
                .map((line, index) => ({ line, where: `${relative(dir, file).split(sep).join('/')}:${index + 1}` }))
                .filter(({ line }) => /c\.json\(.*\.message|['"`]\s*\+\s*\w*[eE]rr(or)?\.message/.test(line))
                .map(({ where }) => where),
        );

        expect(offenders).toEqual([]);
    });

    it.each(ALL.map((route) => [route.method, route.path] as const))('%s %s never returns a database message', async (method, path) => {
        state.failHandlers = true;
        const hasBody = method !== 'GET' && method !== 'DELETE';
        const validBody = JSON.stringify(VALID_BODIES[`${method} ${path}`] ?? {});

        const res = await send({ method, path }, url(path), hasBody ? validBody : undefined);
        const text = await res.text();

        expect(text).not.toContain('secret_table');
        if (res.status >= 400 && (res.headers.get('content-type') ?? '').includes('json')) {
            const body = JSON.parse(text) as Record<string, unknown>;
            expect(Object.keys(body).sort()).toEqual(['code', 'error', 'status']);
            expect(body.status).toBe(res.status);
        }
    });
});
