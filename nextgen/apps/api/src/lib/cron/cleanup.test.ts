import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    removeStaleIncomingUploads: vi.fn(),
    drainStorageDeletionQueue: vi.fn(),
    calls: [] as Array<{ table: string; filters: string[] }>,
    rpcs: [] as string[],
}));

vi.mock('../media/pipeline', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../media/pipeline')>()),
    removeStaleIncomingUploads: mocks.removeStaleIncomingUploads,
}));
vi.mock('../storage-deletion', () => ({ drainStorageDeletionQueue: mocks.drainStorageDeletionQueue }));

const client = {
    from: (table: string) => {
        const call = { table, filters: [] as string[] };
        mocks.calls.push(call);
        const chain: Record<string, unknown> = {};
        chain.delete = () => chain;
        for (const method of ['lt', 'eq']) {
            chain[method] = (column: string) => {
                call.filters.push(`${method}:${column}`);
                return chain;
            };
        }
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ count: 2, error: null }).then(resolve);
        return chain;
    },
    rpc: async (name: string) => {
        mocks.rpcs.push(name);
        return { data: 5, error: null };
    },
};

vi.mock('../supabase/server', () => ({ createAdminClient: () => client }));

import { runCleanup } from './cleanup';

describe('runCleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.calls = [];
        mocks.rpcs = [];
        mocks.removeStaleIncomingUploads.mockResolvedValue(3);
        mocks.drainStorageDeletionQueue.mockResolvedValue(4);
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    it('removes uploads that were signed but never confirmed', async () => {
        const { results } = await runCleanup();

        expect(mocks.removeStaleIncomingUploads).toHaveBeenCalledWith(client);
        expect(results.staleIncomingUploads).toBe(3);
    });

    it('removes the files queued by deletions made in SQL', async () => {
        const { results } = await runCleanup();

        expect(mocks.drainStorageDeletionQueue).toHaveBeenCalledWith(client);
        expect(results.deletedAccountFiles).toBe(4);
    });

    it('deletes expired export rows whatever their status', async () => {
        await runCleanup();

        const exports = mocks.calls.find((call) => call.table === 'instagram_exports');
        expect(exports?.filters).toEqual(['lt:expires_at']);
    });

    it('prunes old rate limit windows', async () => {
        const { results } = await runCleanup();

        expect(mocks.rpcs).toEqual(['prune_rate_limits']);
        expect(results.prunedRateLimits).toBe(5);
    });
});
