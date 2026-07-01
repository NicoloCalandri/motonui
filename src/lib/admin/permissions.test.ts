import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({
            _isNextResponse: true,
            body,
            status: init?.status ?? 200,
        }),
    },
}));

const mockGetUser = vi.fn();
const mockSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
};
const mockFrom = vi.fn(() => mockSelectChain);

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

// ─── System Under Test ──────────────────────────────────────────────────────

import { requireAdmin } from '@/lib/auth/require-admin';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when no user is authenticated', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const result = await requireAdmin();

        expect(result).toMatchObject({ status: 401 });
        expect((result as { body: unknown }).body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('returns 403 when user exists but has no profile', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
        mockSelectChain.single.mockResolvedValue({ data: null, error: null });

        const result = await requireAdmin();

        expect(result).toMatchObject({ status: 403 });
        expect((result as { body: unknown }).body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('returns 403 when user has role "user" (not admin)', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
        mockSelectChain.single.mockResolvedValue({ data: { role: 'user' }, error: null });

        const result = await requireAdmin();

        expect(result).toMatchObject({ status: 403 });
    });

    it('returns { adminId } when user has role "admin"', async () => {
        const userId = 'admin-abc-123';
        mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
        mockSelectChain.single.mockResolvedValue({ data: { role: 'admin' }, error: null });

        const result = await requireAdmin();

        expect(result).toEqual({ adminId: userId });
    });

    it('queries the profiles table for role', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
        mockSelectChain.single.mockResolvedValue({ data: { role: 'admin' }, error: null });

        await requireAdmin();

        expect(mockFrom).toHaveBeenCalledWith('profiles');
        expect(mockSelectChain.select).toHaveBeenCalledWith('role');
        expect(mockSelectChain.eq).toHaveBeenCalledWith('id', 'u1');
    });
});
