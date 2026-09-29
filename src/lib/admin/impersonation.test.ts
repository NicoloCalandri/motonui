import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// NextResponse as class so `instanceof` works in route code
class MockNextResponse {
    body: unknown;
    status: number;
    cookies = { set: vi.fn() };
    constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: { status?: number }) {
        return new MockNextResponse(body, init);
    }
}

vi.mock('next/server', () => ({ NextResponse: MockNextResponse }));

// Token creation is covered in impersonation-token.test.ts
const mockCreateToken = vi.fn();
vi.mock('@/lib/admin/impersonation-token', () => ({
    IMPERSONATION_DURATION_SECONDS: 1800,
    createImpersonationToken: mockCreateToken,
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
        mockCreateToken.mockResolvedValue({
            token: 'signed.jwt.token',
            jti: 'jti-1',
            jtiHash: 'a'.repeat(64),
            expiresAt: new Date(Date.now() + 1_800_000),
        });
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

    it('starts impersonation and sets httpOnly cookies when target user exists', async () => {
        mockSelectSingle.mockResolvedValue({ data: { id: mockTargetId, display_name: 'Test User' }, error: null });

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request(`http://localhost/api/admin/users/${mockTargetId}/impersonate`, {
            method: 'POST',
        });
        const result = (await POST(req, { params: Promise.resolve({ id: mockTargetId }) })) as any;

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ started: true });
        expect(JSON.stringify(result.body)).not.toContain('signed.jwt.token');

        expect(result.cookies.set).toHaveBeenCalledWith(
            'impersonation_token',
            'signed.jwt.token',
            expect.objectContaining({ httpOnly: true })
        );
        expect(result.cookies.set).toHaveBeenCalledWith(
            'impersonation_display_name',
            'Test User',
            expect.objectContaining({ httpOnly: false })
        );
    });

    it('stores only the jti hash in impersonation_tokens', async () => {
        mockSelectSingle.mockResolvedValue({ data: { id: mockTargetId, display_name: 'Test User' }, error: null });

        const { POST } = await import('@/app/api/admin/users/[id]/impersonate/route');
        const req = new Request(`http://localhost/api/admin/users/${mockTargetId}/impersonate`, {
            method: 'POST',
        });
        await POST(req, { params: Promise.resolve({ id: mockTargetId }) });

        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                admin_id: mockAdminId,
                target_id: mockTargetId,
                token: 'a'.repeat(64),
            })
        );
        // The signed token itself is never persisted.
        expect(JSON.stringify(mockInsert.mock.calls)).not.toContain('signed.jwt.token');
    });
});
