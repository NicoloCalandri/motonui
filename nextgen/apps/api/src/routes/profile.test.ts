import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

const mockUser = { id: 'user-1', email: 'user@example.com' };
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
const mockProfileSingle = vi.fn();
const mockProfileUpdateEq = vi.fn();

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => ({
        auth: { getUser: mockGetUser },
        from: (table: string) => {
            if (table !== 'profiles') throw new Error(`unexpected table: ${table}`);
            return {
                select: () => ({ eq: () => ({ single: mockProfileSingle }) }),
                update: () => ({ eq: mockProfileUpdateEq }),
            };
        },
    }),
}));

const { profileRouter } = await import('./profile');

function buildApp() {
    const app = new Hono<AppEnv>();
    app.route('/api/profile', profileRouter);
    return app;
}

beforeEach(() => {
    mockGetUser.mockClear();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockProfileSingle.mockReset();
    mockProfileUpdateEq.mockReset();
});

describe('GET /api/profile', () => {
    it('returns the caller\'s profile', async () => {
        mockProfileSingle.mockResolvedValue({
            data: { display_name: 'Nicolò', avatar_url: null },
            error: null,
        });

        const app = buildApp();
        const res = await app.request('/api/profile', {
            headers: { Authorization: 'Bearer valid-token' },
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            id: 'user-1',
            email: 'user@example.com',
            fullName: 'Nicolò',
            avatarUrl: null,
        });
    });
});

describe('PATCH /api/profile', () => {
    it('rejects an empty fullName', async () => {
        const app = buildApp();
        const res = await app.request('/api/profile', {
            method: 'PATCH',
            headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: '' }),
        });

        expect(res.status).toBe(400);
    });

    it('updates the display name', async () => {
        mockProfileUpdateEq.mockResolvedValue({ error: null });

        const app = buildApp();
        const res = await app.request('/api/profile', {
            method: 'PATCH',
            headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: 'Nicolò Calandri' }),
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ fullName: 'Nicolò Calandri' });
    });
});
