import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

const mockUser = { id: 'user-1', email: 'user@example.com' };

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
const mockTripMembersSelect = vi.fn();
const mockTripsInsert = vi.fn();
const mockTripMembersInsert = vi.fn();

function makeUserSupabaseStub() {
    return {
        auth: { getUser: mockGetUser },
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

function makeAdminSupabaseStub() {
    return {
        from: (table: string) => {
            if (table === 'trips') return { insert: mockTripsInsert };
            if (table === 'trip_members') return { insert: mockTripMembersInsert };
            throw new Error(`unexpected table: ${table}`);
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
    mockTripsInsert.mockReset();
    mockTripMembersInsert.mockReset();
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

    it('creates a trip and adds the caller as owner member', async () => {
        mockTripsInsert.mockReturnValue({
            select: () => ({
                single: () =>
                    Promise.resolve({ data: { id: 't1', title: 'Giappone', destination: 'Tokyo' }, error: null }),
            }),
        });
        mockTripMembersInsert.mockResolvedValue({ error: null });

        const app = buildApp();
        const res = await app.request('/api/trips', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Giappone', destination: 'Tokyo' }),
        });

        expect(res.status).toBe(201);
        expect(mockTripMembersInsert).toHaveBeenCalledWith({
            trip_id: 't1',
            user_id: mockUser.id,
            role: 'owner',
        });
    });
});
