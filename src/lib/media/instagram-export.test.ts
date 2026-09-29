// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/errors';
import { queryChain } from '@/test/supabase-mock';

const mocks = vi.hoisted(() => ({ downloadFile: vi.fn(), uploadFile: vi.fn() }));

vi.mock('@/lib/storage', () => ({
    Buckets: { tripMedia: 'trip-media', instagramExports: 'instagram-exports' },
    downloadFile: mocks.downloadFile,
    uploadFile: mocks.uploadFile,
}));
vi.mock('@/lib/media/process', () => ({
    cropToAspect: vi.fn(async (buffer: Buffer) => buffer),
    applyFilter: vi.fn(async (buffer: Buffer) => buffer),
    overlayText: vi.fn(async (buffer: Buffer) => buffer),
}));

import { generateExport } from './instagram-export';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const OTHER = '10000000-0000-0000-0000-00000000000c';

function run(rows: object[]) {
    const chain = queryChain({ data: rows, error: null });
    const supabase = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
    const promise = generateExport({
        exportId: 'e1', tripId: TRIP, mediaIds: ['m1'], type: 'carousel', options: {},
        generateCaption: false, language: 'it', supabase,
    });
    return { chain, promise };
}

describe('generateExport sources (T-2.4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.downloadFile.mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])]));
        mocks.uploadFile.mockResolvedValue('https://zip');
    });

    it('reads photos of the trip from the private bucket, never from a stored URL', async () => {
        const path = `trips/${TRIP}/original/a.jpg`;
        const { chain, promise } = run([{ id: 'm1', trip_id: TRIP, storage_path: path, caption: null }]);

        await expect(promise).resolves.toMatchObject({ downloadUrl: 'https://zip' });
        expect(chain.calls).toContainEqual(['eq', ['trip_id', TRIP]]);
        expect(mocks.downloadFile).toHaveBeenCalledWith('trip-media', path);
    });

    it.each([
        ['an external link', { storage_path: null, url: 'http://169.254.169.254/latest' }],
        ['a path of another trip', { storage_path: `trips/${OTHER}/original/b.jpg` }],
    ])('refuses %s without downloading anything', async (_, source) => {
        const { promise } = run([{ id: 'm1', trip_id: TRIP, caption: null, ...source }]);

        await expect(promise).rejects.toBeInstanceOf(AppError);
        expect(mocks.downloadFile).not.toHaveBeenCalled();
    });
});
