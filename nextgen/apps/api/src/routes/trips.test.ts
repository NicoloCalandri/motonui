import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

const mockUser = { id: 'user-1', email: 'user@example.com' };

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
const mockTripMembersSelect = vi.fn();
const mockRpc = vi.fn();
const adminCalls: string[] = [];

function makeUserSupabaseStub() {
    return {
        auth: { getUser: mockGetUser },
        rpc: mockRpc,
        from: (table: string) => {
            if (table === 'trip_members') {
                return { select: mockTripMembersSelect };
            }
            if (table === 'profiles') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () =>
                                Promise.resolve({ data: { role: 'user', suspended_at: null }, error: null }),
                        }),
                    }),
                };
            }
            throw new Error(`unexpected table: ${table}`);
        },
    };
}

/** Creating a trip must not need the service role: any use of it is recorded. */
function makeAdminSupabaseStub() {
    return {
        from: (table: string) => {
            adminCalls.push(table);
            throw new Error(`service role used on ${table}`);
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => makeUserSupabaseStub(),
    createAdminClient: () => makeAdminSupabaseStub(),
}));

const { tripsRouter } = await import('./trips');

function buildApp() {
    const app = new Hono<AppEnv>();
    app.route('/api/trips', tripsRouter);
    return app;
}

beforeEach(() => {
    mockGetUser.mockClear();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockTripMembersSelect.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: { id: 't1', title: 'Giappone', destination: 'Tokyo' }, error: null });
    adminCalls.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/trips', () => {
    it('returns 401 without an Authorization header', async () => {
        const app = buildApp();
        const res = await app.request('/api/trips');
        expect(res.status).toBe(401);
    });

    it('returns the caller\'s trips, unwrapped from trip_members', async () => {
        mockTripMembersSelect.mockReturnValue({
            eq: () => ({
                order: () =>
                    Promise.resolve({
                        data: [
                            { trip_id: 't1', trips: { id: 't1', title: 'Giappone' } },
                            { trip_id: 't2', trips: null },
                        ],
                        error: null,
                    }),
            }),
        });

        const app = buildApp();
        const res = await app.request('/api/trips', {
            headers: { Authorization: 'Bearer valid-token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual([{ id: 't1', title: 'Giappone' }]);
    });
});

describe('POST /api/trips', () => {
    it('returns 400 for invalid input', async () => {
        const app = buildApp();
        const res = await app.request('/api/trips', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '' }),
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { code: string };
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    const create = (body: Record<string, unknown>) =>
        buildApp().request('/api/trips', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

    it('creates the trip and its owner in one database call, with the caller\'s session', async () => {
        const res = await create({ title: 'Giappone', destination: 'Tokyo', start_date: '2026-11-01', description: 'Autunno' });

        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({ id: 't1' });
        expect(mockRpc).toHaveBeenCalledWith('create_trip', {
            p_title: 'Giappone',
            p_destination: 'Tokyo',
            p_start_date: '2026-11-01',
            p_end_date: undefined,
            p_description: 'Autunno',
            p_cover_image: undefined,
        });
        expect(adminCalls).toEqual([]);
    });

    it('treats an empty date as no date', async () => {
        await create({ title: 'Giappone', destination: 'Tokyo', start_date: '', end_date: '' });

        expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_start_date: undefined, p_end_date: undefined });
    });

    it.each(['domani', '2026-13-40', '01/11/2026'])('refuses the date %s', async (start_date) => {
        const res = await create({ title: 'Giappone', destination: 'Tokyo', start_date });

        expect(res.status).toBe(400);
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('answers 500 without the database message when the trip cannot be created', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'relation "secret_table" does not exist' } });

        const res = await create({ title: 'Giappone', destination: 'Tokyo' });

        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain('secret_table');
    });
});
