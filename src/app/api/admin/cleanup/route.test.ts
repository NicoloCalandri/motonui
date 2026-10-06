// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminClientMock, removeExpiredMock } = vi.hoisted(() => ({
    createAdminClientMock: vi.fn(),
    removeExpiredMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: createAdminClientMock }));
vi.mock('@/lib/instagram-cleanup', () => ({ removeExpiredExportObjects: removeExpiredMock }));
vi.mock('@/lib/media/pipeline', () => ({ removeStaleIncomingUploads: vi.fn(async () => 2) }));
vi.mock('@/lib/storage-deletion', () => ({ drainStorageDeletionQueue: vi.fn(async () => 5) }));

import { GET } from './route';
import { GET as sendReminders } from '../send-reminders/route';

// Low-entropy placeholder: gitleaks flags realistic-looking values.
const SECRET = 'x'.repeat(40);
const context = { params: Promise.resolve({}) };

function cronRequest(path: string, authorization?: string) {
    return new Request(`https://motonui.app${path}`, { headers: authorization ? { authorization } : {} });
}

function deleteChain(count: number) {
    const chain = { delete: vi.fn(() => chain), lt: vi.fn(async () => ({ count })) };
    return chain;
}

describe('cron routes', () => {
    beforeEach(() => {
        vi.stubEnv('CRON_SECRET', SECRET);
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
        createAdminClientMock.mockReset();
        removeExpiredMock.mockReset();
    });

    it.each([
        ['/api/admin/cleanup', GET],
        ['/api/admin/send-reminders', sendReminders],
    ])('%s rejects requests without the CRON_SECRET bearer', async (path, handler) => {
        for (const auth of [undefined, 'Bearer wrong-secret', SECRET]) {
            const res = await handler(cronRequest(path, auth), context);
            expect(res.status).toBe(401);
            expect(await res.json()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
        }
        expect(createAdminClientMock).not.toHaveBeenCalled();
    });

    it('cleanup deletes the ZIP objects and then the expired rows', async () => {
        const chain = deleteChain(3);
        const rpc = vi.fn(async () => ({ data: 7, error: null }));
        createAdminClientMock.mockResolvedValue({ from: vi.fn(() => chain), rpc });
        removeExpiredMock.mockResolvedValue(4);

        const res = await GET(cronRequest('/api/admin/cleanup', `Bearer ${SECRET}`), context);

        expect(res.status).toBe(200);
        expect(removeExpiredMock).toHaveBeenCalledTimes(1);
        const body = await res.json();
        expect(body.results).toMatchObject({
            removedExportObjects: 4, expiredExports: 3, staleIncomingUploads: 2, deletedAccountFiles: 5, prunedRateLimits: 7,
        });
        expect(rpc).toHaveBeenCalledWith('prune_rate_limits');
    });

    it('cleanup reports a failure without leaking storage details', async () => {
        createAdminClientMock.mockResolvedValue({ from: vi.fn() });
        removeExpiredMock.mockRejectedValue(new Error('[motonui][cleanup][instagram] list: secret detail'));

        const res = await GET(cronRequest('/api/admin/cleanup', `Bearer ${SECRET}`), context);

        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('secret detail');
    });
});
