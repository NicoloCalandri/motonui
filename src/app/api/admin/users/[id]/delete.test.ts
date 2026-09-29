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

const ADMIN_ID = 'admin-ccc';
const TARGET_ID = 'target-ddd';
const TARGET_EMAIL = 'target@example.com';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
    requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/errors', () => ({
    ok: vi.fn((data: unknown) => ({ _ok: true, data })),
}));

const mockDeleteUser = vi.fn();
const mockAdminUserViewSingle = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

const mockFrom = vi.fn((table: string) => {
    if (table === 'admin_user_view') {
        return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: mockAdminUserViewSingle,
        };
    }
    if (table === 'admin_audit_log') {
        return { insert: mockInsert };
    }
    return {};
});

const mockRpc = vi.fn();
const mockDrain = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
        rpc: mockRpc,
        auth: { admin: { deleteUser: mockDeleteUser } },
    })),
}));
vi.mock('@/lib/storage-deletion', () => ({ drainStorageDeletionQueue: mockDrain }));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDeleteRequest(body: unknown) {
    return new Request(`http://localhost/api/admin/users/${TARGET_ID}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/users/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireAdmin.mockResolvedValue({ adminId: ADMIN_ID });
        mockAdminUserViewSingle.mockResolvedValue({ data: { email: TARGET_EMAIL } });
        mockDeleteUser.mockResolvedValue({ error: null });
        mockRpc.mockResolvedValue({ data: { transferred_trips: 1, deleted_trips: 0 }, error: null });
        mockDrain.mockResolvedValue(3);
    });

    it('purges data (trip transfer, file queue) before deleting the auth user, then removes files (T-2.9)', async () => {
        const order: string[] = [];
        mockRpc.mockImplementation(async () => { order.push('purge'); return { data: {}, error: null }; });
        mockDeleteUser.mockImplementation(async () => { order.push('deleteUser'); return { error: null }; });
        mockDrain.mockImplementation(async () => { order.push('drain'); return 0; });

        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        await DELETE(makeDeleteRequest({ confirmEmail: TARGET_EMAIL }), { params: Promise.resolve({ id: TARGET_ID }) });

        expect(mockRpc).toHaveBeenCalledWith('purge_user_data', { p_user: TARGET_ID });
        expect(order).toEqual(['purge', 'deleteUser', 'drain']);
    });

    it('does not delete the auth user when the purge fails', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'purge failed' } });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const result = await DELETE(makeDeleteRequest({ confirmEmail: TARGET_EMAIL }), { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as { status: number }).status).toBe(500);
        expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
        mockRequireAdmin.mockResolvedValue(
            MockNextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
        );

        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: TARGET_EMAIL });
        const result = await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as any).status).toBe(401);
    });

    it('returns 403 when admin tries to delete themselves', async () => {
        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: 'admin@example.com' });
        const result = await DELETE(req, { params: Promise.resolve({ id: ADMIN_ID }) });

        expect((result as any).status).toBe(403);
        expect((result as any).body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('returns 400 when confirmEmail is missing', async () => {
        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({});
        const result = await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as any).status).toBe(400);
        expect((result as any).body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('returns 404 when target user does not exist', async () => {
        mockAdminUserViewSingle.mockResolvedValue({ data: null });

        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: 'nobody@example.com' });
        const result = await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as any).status).toBe(404);
        expect((result as any).body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns 400 when confirmEmail does not match', async () => {
        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: 'wrong@example.com' });
        const result = await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as any).status).toBe(400);
        expect((result as any).body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('returns 500 when deleteUser fails', async () => {
        mockDeleteUser.mockResolvedValue({ error: { message: 'Auth service error' } });

        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: TARGET_EMAIL });
        const result = await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as any).status).toBe(500);
        expect((result as any).body).toMatchObject({ code: 'INTERNAL_ERROR' });
    });

    it('deletes successfully when confirmEmail matches', async () => {
        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: TARGET_EMAIL });
        const result = await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect((result as any)._ok).toBe(true);
        expect(mockDeleteUser).toHaveBeenCalledWith(TARGET_ID);
    });

    it('writes audit log before deleting', async () => {
        const { DELETE } = await import('@/app/api/admin/users/[id]/route');
        const req = makeDeleteRequest({ confirmEmail: TARGET_EMAIL });
        await DELETE(req, { params: Promise.resolve({ id: TARGET_ID }) });

        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                admin_id: ADMIN_ID,
                action: 'delete',
                target_id: TARGET_ID,
            })
        );
    });
});
