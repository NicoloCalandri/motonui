// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain, type QueryChain } from '@/test/supabase-mock';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const MEDIA = '30000000-0000-0000-0000-00000000000e';
const USER = { id: '00000000-0000-0000-0000-00000000000a' };

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    media: vi.fn(),
    requireTripMember: vi.fn(),
    uploadPrivateFile: vi.fn(),
    withSignedUrls: vi.fn(),
    removeMediaFiles: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mocks.getUser },
        from: vi.fn(() => mocks.media()),
    })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: mocks.requireTripMember, requireDayInTrip: vi.fn() }));
vi.mock('@/lib/storage', () => ({
    Buckets: { tripMedia: 'trip-media' },
    validateFile: vi.fn(),
    uploadPrivateFile: mocks.uploadPrivateFile,
}));
vi.mock('@/lib/trip-storage', () => ({
    withSignedUrls: mocks.withSignedUrls,
    removeMediaFiles: mocks.removeMediaFiles,
}));

import { GET, POST } from './route';
import { DELETE } from './[mediaId]/route';

const tripCtx = { params: Promise.resolve({ id: TRIP }) };
const BASE = `http://localhost/api/trips/${TRIP}/media`;

let chain: QueryChain;

describe('media routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ data: { user: USER } });
        mocks.requireTripMember.mockResolvedValue(undefined);
        mocks.withSignedUrls.mockImplementation(async (_client: unknown, _trip: string, rows: object[]) =>
            rows.map((row) => ({ ...row, signed_url: 'https://signed/o', signed_thumb_url: null })));
        chain = queryChain({ data: [{ id: MEDIA, storage_path: `trips/${TRIP}/original/a.jpg` }], error: null });
        mocks.media.mockReturnValue(chain);
    });

    it('lists media with signed URLs for the trip', async () => {
        const res = await GET(new Request(BASE), tripCtx);

        expect(res.status).toBe(200);
        expect(mocks.withSignedUrls).toHaveBeenCalledWith(expect.anything(), TRIP, expect.any(Array));
        expect((await res.json())[0].signed_url).toBe('https://signed/o');
        expect(chain.calls).toContainEqual(['eq', ['trip_id', TRIP]]);
    });

    it('uploads to the private bucket under a server-built path and stores no public URL', async () => {
        chain = queryChain({ data: { id: MEDIA }, error: null });
        mocks.media.mockReturnValue(chain);
        const form = new FormData();
        form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], '../x.php', { type: 'image/jpeg' }));

        const res = await POST(new Request(BASE, { method: 'POST', body: form }), tripCtx);

        expect(res.status).toBe(201);
        const [bucket, path] = mocks.uploadPrivateFile.mock.calls[0];
        expect(bucket).toBe('trip-media');
        expect(path).toMatch(new RegExp(`^trips/${TRIP}/original/[0-9a-f-]{36}\\.jpg$`));
        const inserted = chain.insert.mock.calls[0][0];
        expect(inserted).toMatchObject({ storage_path: path, trip_id: TRIP, uploaded_by: USER.id });
        expect(inserted).not.toHaveProperty('url');
    });

    it('rejects an invalid day_id', async () => {
        const form = new FormData();
        form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' }));
        form.append('day_id', 'not-a-uuid');

        const res = await POST(new Request(BASE, { method: 'POST', body: form }), tripCtx);

        expect(res.status).toBe(400);
        expect(mocks.uploadPrivateFile).not.toHaveBeenCalled();
    });

    it('deletes the row and then its files, scoped to the trip', async () => {
        const row = { storage_path: `trips/${TRIP}/original/a.jpg`, thumb_path: null };
        chain = queryChain({ data: row, error: null });
        mocks.media.mockReturnValue(chain);

        const res = await DELETE(new Request(`${BASE}/${MEDIA}`, { method: 'DELETE' }), {
            params: Promise.resolve({ id: TRIP, mediaId: MEDIA }),
        });

        expect(res.status).toBe(200);
        expect(chain.calls).toContainEqual(['eq', ['trip_id', TRIP]]);
        expect(mocks.removeMediaFiles).toHaveBeenCalledWith(TRIP, row);
    });

    it('returns 404 and removes nothing for media of another trip', async () => {
        mocks.media.mockReturnValue(queryChain({ data: null, error: null }));

        const res = await DELETE(new Request(`${BASE}/${MEDIA}`, { method: 'DELETE' }), {
            params: Promise.resolve({ id: TRIP, mediaId: MEDIA }),
        });

        expect(res.status).toBe(404);
        expect(mocks.removeMediaFiles).not.toHaveBeenCalled();
    });
});
