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

type MockOkResponse = { _ok: boolean; data?: unknown };

vi.mock('next/server', () => ({ NextResponse: MockNextResponse }));

const ADMIN_ID = 'admin-aaa';
const TARGET_ID = 'target-bbb';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
    requireAdmin: mockRequireAdmin,
}));

const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
        return { update: vi.fn(() => ({ eq: mockEq })) };
    }
    if (table === 'admin_audit_log') {
        return { insert: mockInsert };
    }
    return { update: mockUpdate, insert: mockInsert, eq: mockEq };
});

vi.mock('@/lib/errors', () => ({
    ok: vi.fn((data: unknown) => ({ _ok: true, data })),
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
    return new Request(`http://localhost/api/admin/users/${TARGET_ID}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/admin/users/[id]/suspend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireAdmin.mockResolvedValue({ adminId: ADMIN_ID });
    });

    it('returns 401 when not authenticated', async () => {
        mockRequireAdmin.mockResolvedValue(
            MockNextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
        );

        const { POST } = await import('@/app/api/admin/users/[id]/suspend/route');
        const req = makeRequest({ reason: 'test' });
        const result = await POST(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as MockNextResponse).status).toBe(401);
    });

    it('returns 403 when admin tries to suspend themselves', async () => {
        const { POST } = await import('@/app/api/admin/users/[id]/suspend/route');
        const req = makeRequest({ reason: 'self-test' });
        const result = await POST(req, { params: Promise.resolve({ id: ADMIN_ID }) });

        expect((result as MockNextResponse).status).toBe(403);
        expect((result as MockNextResponse).body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('returns 400 when reason is missing', async () => {
        const { POST } = await import('@/app/api/admin/users/[id]/suspend/route');
        const req = makeRequest({});
        const result = await POST(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as MockNextResponse).status).toBe(400);
        expect((result as MockNextResponse).body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('returns 400 when reason is empty string', async () => {
        const { POST } = await import('@/app/api/admin/users/[id]/suspend/route');
        const req = makeRequest({ reason: '' });
        const result = await POST(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as MockNextResponse).status).toBe(400);
    });

    it('returns 500 when database update fails', async () => {
        const badFrom = vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    update: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
                    })),
                };
            }
            return { insert: vi.fn() };
        });
        const { createAdminClient } = await import('@/lib/supabase/server');
        vi.mocked(createAdminClient).mockResolvedValueOnce({ from: badFrom } as unknown as Awaited<ReturnType<typeof createAdminClient>>);

        const { POST } = await import('@/app/api/admin/users/[id]/suspend/route');
        const req = makeRequest({ reason: 'violation' });
        const result = await POST(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as MockNextResponse).status).toBe(500);
    });

    it('suspends successfully and writes audit log', async () => {
        const capturedAudit = { value: null as unknown };
        const auditInsert = vi.fn((row: unknown) => {
            capturedAudit.value = row;
            return Promise.resolve({ error: null });
        });
        const updateEq = vi.fn().mockResolvedValue({ error: null });
        const goodFrom = vi.fn((table: string) => {
            if (table === 'profiles') {
                return { update: vi.fn(() => ({ eq: updateEq })) };
            }
            if (table === 'admin_audit_log') {
                return { insert: auditInsert };
            }
            return {};
        });
        const { createAdminClient } = await import('@/lib/supabase/server');
        vi.mocked(createAdminClient).mockResolvedValueOnce({ from: goodFrom } as unknown as Awaited<ReturnType<typeof createAdminClient>>);

        const { POST } = await import('@/app/api/admin/users/[id]/suspend/route');
        const req = makeRequest({ reason: 'Violazione delle norme' });
        const result = await POST(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as MockOkResponse)._ok).toBe(true);
        expect(updateEq).toHaveBeenCalledWith('id', TARGET_ID);
        expect(auditInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                admin_id: ADMIN_ID,
                action: 'suspend',
                target_id: TARGET_ID,
            })
        );
    });
});
