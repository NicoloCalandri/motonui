import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// NextResponse as class so `instanceof` works in route code
class MockNextResponse {
    body: unknown;
    status: number;
    constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: { status?: number }) {
        return new MockNextResponse(body, init);
    }
}

vi.mock('next/server', () => ({ NextResponse: MockNextResponse }));

// Mock jose so we don't need Web Crypto in jsdom
const mockSign = vi.fn(() => Promise.resolve('mock.jwt.token'));
vi.mock('jose', () => ({
    SignJWT: class {
        constructor(_payload: unknown) {}
        setProtectedHeader() { return this; }
        setExpirationTime() { return this; }
        sign(_key: unknown) { return mockSign(); }
    },
    jwtVerify: vi.fn(),
}));

const mockAdminId = 'admin-111';
const mockTargetId = 'target-222';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
    requireAdmin: mockRequireAdmin,
}));

const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockSelectSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: mockEq,
    single: mockSelectSingle,
    insert: mockInsert,
};
const mockFrom = vi.fn(() => mockSelectChain);

vi.mock('@/lib/errors', () => ({
    ok: vi.fn((data: unknown) => ({ _ok: true, data })),
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
    })),
}));

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/admin/users/[id]/impersonate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_IMPERSONATION_SECRET = TEST_SECRET;
        mockRequireAdmin.mockResolvedValue({ adminId: mockAdminId });
    });

    it('returns 500 when ADMIN_IMPERSONATION_SECRET is not set', async () => {
        delete process.env.ADMIN_IMPERSONATION_SECRET;

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request('http://localhost/api/admin/users/target-222/impersonate', {
            method: 'POST',
        });
        const result = await POST(req, { params: Promise.resolve({ id: mockTargetId }) });

        expect((result as any).status).toBe(500);
    });

    it('returns 500 when secret is shorter than 32 chars', async () => {
        process.env.ADMIN_IMPERSONATION_SECRET = 'short';

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request('http://localhost/api/admin/users/target-222/impersonate', {
            method: 'POST',
        });
        const result = await POST(req, { params: Promise.resolve({ id: mockTargetId }) });

        expect((result as any).status).toBe(500);
    });

    it('returns 401 when not authenticated', async () => {
        mockRequireAdmin.mockResolvedValue(
            MockNextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
        );

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request('http://localhost/api/admin/users/target/impersonate', {
            method: 'POST',
        });
        const result = await POST(req, { params: Promise.resolve({ id: mockTargetId }) });

        expect((result as any).status).toBe(401);
    });

    it('returns 404 when target user does not exist', async () => {
        mockSelectSingle.mockResolvedValue({ data: null, error: null });

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request('http://localhost/api/admin/users/nonexistent/impersonate', {
            method: 'POST',
        });
        const result = await POST(req, { params: Promise.resolve({ id: 'nonexistent' }) });

        expect((result as any).status).toBe(404);
    });

    it('returns token when target user exists', async () => {
        mockSelectSingle.mockResolvedValue({ data: { id: mockTargetId, display_name: 'Test User' }, error: null });

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request(`http://localhost/api/admin/users/${mockTargetId}/impersonate`, {
            method: 'POST',
        });
        const result = await POST(req, { params: Promise.resolve({ id: mockTargetId }) });

        expect((result as any)._ok).toBe(true);
        expect((result as any).data).toHaveProperty('token');
    });

    it('stores token in impersonation_tokens table', async () => {
        mockSelectSingle.mockResolvedValue({ data: { id: mockTargetId, display_name: 'Test User' }, error: null });
        mockSign.mockResolvedValue('signed.jwt.token');

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request(`http://localhost/api/admin/users/${mockTargetId}/impersonate`, {
            method: 'POST',
        });
        await POST(req, { params: Promise.resolve({ id: mockTargetId }) });

        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                admin_id: mockAdminId,
                target_id: mockTargetId,
            })
        );
    });
});
