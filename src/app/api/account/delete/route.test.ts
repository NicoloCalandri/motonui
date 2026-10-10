// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    signOut: vi.fn(),
    drain: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser, signOut: mocks.signOut }, rpc: mocks.rpc })),
    createAdminClient: vi.fn(async () => ({})),
}));
vi.mock('@/lib/storage-deletion', () => ({ drainStorageDeletionQueue: mocks.drain }));

import { POST } from './route';

const ctx = { params: Promise.resolve({}) };

function post(body: unknown) {
    return new Request('http://localhost/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/account/delete (T-2.9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
        mocks.rpc.mockResolvedValue({ data: { transferred_trips: 1, deleted_trips: 2 }, error: null });
        mocks.drain.mockResolvedValue(4);
    });

    it('requires the typed confirmation', async () => {
        const res = await POST(post({ confirm: 'si' }), ctx);
        expect(res.status).toBe(400);
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('deletes with the user JWT, removes the files and signs out', async () => {
        const res = await POST(post({ confirm: 'ELIMINA' }), ctx);

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ deleted: true, transferred_trips: 1, deleted_trips: 2 });
        expect(mocks.rpc).toHaveBeenCalledWith('delete_my_account', { confirm_text: 'DELETE' });
        expect(mocks.drain).toHaveBeenCalled();
        expect(mocks.signOut).toHaveBeenCalled();
    });

    it('still succeeds when file removal is deferred to the cron', async () => {
        mocks.drain.mockRejectedValue(new Error('storage down'));
        const res = await POST(post({ confirm: 'ELIMINA' }), ctx);
        expect(res.status).toBe(200);
    });

    it('reports a failed deletion without internal details', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'relation "x" violates constraint' } });
        const res = await POST(post({ confirm: 'ELIMINA' }), ctx);
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('constraint');
        expect(mocks.drain).not.toHaveBeenCalled();
    });
});
