// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unzipSync } from 'fflate';
import { AppError } from '@/lib/errors';
import { queryChain } from '@/test/supabase-mock';

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/media/process', () => ({
    HEX_COLOR: /^#[0-9a-fA-F]{6}$/,
    cropToAspect: vi.fn(async (buffer: Buffer) => buffer),
    applyFilter: vi.fn(async (buffer: Buffer) => buffer),
    overlayText: vi.fn(async (buffer: Buffer) => buffer),
}));

import { exportZipPath, generateExport } from './instagram-export';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const OTHER = '10000000-0000-0000-0000-00000000000c';

function adminWith(rows: object[]) {
    const chain = queryChain({ data: rows, error: null });
    const download = vi.fn(async (path: string) => ({ data: new Blob([path]), error: null }));
    const upload = vi.fn(async () => ({ data: {}, error: null }));
    const admin = {
        from: vi.fn(() => chain),
        storage: { from: vi.fn(() => ({ download, upload })) },
    } as unknown as SupabaseClient;
    return { admin, chain, download, upload };
}

function run(admin: SupabaseClient, mediaIds: string[]) {
    return generateExport({
        admin, exportId: 'e1', tripId: TRIP, mediaIds, format: 'carousel', filter: 'none',
        generateCaption: false, language: 'it',
    });
}

describe('generateExport (T-2.7, T-2.4)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reads photos from the private bucket in the selected order and writes a private ZIP', async () => {
        const rows = ['a', 'b', 'c'].map((id) => ({ id, trip_id: TRIP, mime_type: 'image/webp', storage_path: `trips/${TRIP}/original/${id}.webp`, caption: null }));
        const { admin, chain, download, upload } = adminWith(rows);

        const result = await run(admin, ['c', 'a', 'b']);

        expect(chain.calls).toContainEqual(['eq', ['trip_id', TRIP]]);
        expect(download.mock.calls.map(([path]) => path)).toEqual([
            `trips/${TRIP}/original/c.webp`, `trips/${TRIP}/original/a.webp`, `trips/${TRIP}/original/b.webp`,
        ]);
        expect(result).toMatchObject({ zipPath: exportZipPath(TRIP, 'e1'), slideCount: 3 });

        const [path, body] = upload.mock.calls[0] as unknown as [string, Buffer];
        expect(path).toBe(`${TRIP}/e1.zip`);
        const files = unzipSync(new Uint8Array(body));
        expect(Object.keys(files).sort()).toEqual(['README.txt', 'carousel_01.jpg', 'carousel_02.jpg', 'carousel_03.jpg']);
        expect(new TextDecoder().decode(files['carousel_01.jpg'])).toContain('/c.webp');
    });

    it.each([
        ['only external links', [{ id: 'x', trip_id: TRIP, mime_type: 'image/jpeg', storage_path: null, caption: null }]],
        ['only videos', [{ id: 'v', trip_id: TRIP, mime_type: 'video/mp4', storage_path: `trips/${TRIP}/original/v.mp4`, caption: null }]],
    ])('refuses a selection with %s', async (_, rows) => {
        const { admin, download } = adminWith(rows);
        await expect(run(admin, rows.map((row) => row.id))).rejects.toBeInstanceOf(AppError);
        expect(download).not.toHaveBeenCalled();
    });

    it('never reads a path of another trip', async () => {
        const { admin, download } = adminWith([
            { id: 'y', trip_id: TRIP, mime_type: 'image/webp', storage_path: `trips/${OTHER}/original/y.webp`, caption: null },
        ]);
        await expect(run(admin, ['y'])).rejects.toBeInstanceOf(AppError);
        expect(download).not.toHaveBeenCalled();
    });
});
