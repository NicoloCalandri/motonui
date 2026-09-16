import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
    },
}));

const USER_ID = 'user-123';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
};
const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
        return {
            ...mockSelectChain,
            update: vi.fn(() => ({ eq: mockUpdateEq })),
        };
    }
    return {};
});

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

const emptyParams = { params: Promise.resolve({}) as Promise<Record<string, string>> };

function makePatchRequest(body: unknown) {
    return new Request('http://localhost/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('GET /api/profile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'a@b.com' } } });
    });

    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const { GET } = await import('@/app/api/profile/route');
        const result = (await GET(new Request('http://localhost/api/profile'), emptyParams)) as any;

        expect(result.status).toBe(401);
    });

    it('returns profile data for the authenticated user', async () => {
        mockSingle.mockResolvedValue({ data: { display_name: 'Nico', avatar_url: 'http://x/y.png' } });

        const { GET } = await import('@/app/api/profile/route');
        const result = (await GET(new Request('http://localhost/api/profile'), emptyParams)) as any;

        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ id: USER_ID, fullName: 'Nico', avatarUrl: 'http://x/y.png' });
    });
});

describe('PATCH /api/profile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'a@b.com' } } });
        mockUpdateEq.mockResolvedValue({ error: null });
    });

    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: 'Nico' }), emptyParams)) as any;

        expect(result.status).toBe(401);
    });

    it('returns 400 when fullName is missing', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({}), emptyParams)) as any;

        expect(result.status).toBe(400);
        expect(result.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when fullName is empty after trimming', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: '   ' }), emptyParams)) as any;

        expect(result.status).toBe(400);
    });

    it('returns 400 when fullName exceeds 100 characters', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const tooLong = 'a'.repeat(101);
        const result = (await PATCH(makePatchRequest({ fullName: tooLong }), emptyParams)) as any;

        expect(result.status).toBe(400);
        expect(result.body.code).toBe('VALIDATION_ERROR');
    });

    it('updates the display name and returns it when valid', async () => {
        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: 'Nico Calandri' }), emptyParams)) as any;

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ fullName: 'Nico Calandri' });
        expect(mockUpdateEq).toHaveBeenCalledWith('id', USER_ID);
    });

    it('returns 500 when the database update fails', async () => {
        mockUpdateEq.mockResolvedValue({ error: { message: 'db down' } });

        const { PATCH } = await import('@/app/api/profile/route');
        const result = (await PATCH(makePatchRequest({ fullName: 'Nico' }), emptyParams)) as any;

        expect(result.status).toBe(500);
    });
});
