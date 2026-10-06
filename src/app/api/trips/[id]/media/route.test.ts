// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain, type QueryChain } from '@/test/supabase-mock';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const MEDIA = '30000000-0000-0000-0000-00000000000e';
const USER = { id: '00000000-0000-0000-0000-00000000000a' };
const INCOMING = `trips/${TRIP}/incoming/0f8e1c2a-aaaa-bbbb-cccc-000000000001.jpg`;

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    media: vi.fn(),
    requireTripMember: vi.fn(),
    requireDayInTrip: vi.fn(),
    createAdminClient: vi.fn(),
    withSignedUrls: vi.fn(),
    removeMediaFiles: vi.fn(),
    createUploadTarget: vi.fn(),
    ingestUpload: vi.fn(),
}));

// Rate limiting has its own tests (src/lib/rate-limit.test.ts).
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
    enforceRateLimit: vi.fn(async () => undefined),
}));
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mocks.getUser },
        from: vi.fn(() => mocks.media()),
    })),
    createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: mocks.requireTripMember, requireDayInTrip: mocks.requireDayInTrip }));
vi.mock('@/lib/trip-storage', () => ({
    withSignedUrls: mocks.withSignedUrls,
    removeMediaFiles: mocks.removeMediaFiles,
}));
vi.mock('@/lib/media/pipeline', () => ({
    MAX_UPLOAD_BYTES: 50 * 1024 * 1024,
    UPLOAD_EXTENSION_BY_MIME: { 'image/jpeg': 'jpg', 'video/mp4': 'mp4' },
    createUploadTarget: mocks.createUploadTarget,
    ingestUpload: mocks.ingestUpload,
}));

import { GET } from './route';
import { DELETE } from './[mediaId]/route';
import { POST as UPLOADS } from './uploads/route';
import { POST as CONFIRM } from './confirm/route';

const tripCtx = { params: Promise.resolve({ id: TRIP }) };
const BASE = `http://localhost/api/trips/${TRIP}/media`;

function post(path: string, body: unknown) {
    return new Request(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

let chain: QueryChain;

describe('media routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ data: { user: USER } });
        mocks.requireTripMember.mockResolvedValue(undefined);
        mocks.requireDayInTrip.mockResolvedValue(undefined);
        mocks.createAdminClient.mockResolvedValue({});
        mocks.withSignedUrls.mockImplementation(async (_client: unknown, _trip: string, rows: object[]) =>
            rows.map((row) => ({ ...row, signed_url: 'https://signed/o', signed_thumb_url: null })));
        chain = queryChain({ data: [{ id: MEDIA, storage_path: `trips/${TRIP}/original/a.webp` }], error: null });
        mocks.media.mockReturnValue(chain);
    });

    it('lists media with signed URLs for the trip', async () => {
        const res = await GET(new Request(BASE), tripCtx);

        expect(res.status).toBe(200);
        expect(mocks.withSignedUrls).toHaveBeenCalledWith(expect.anything(), TRIP, expect.any(Array));
        expect((await res.json())[0].signed_url).toBe('https://signed/o');
        expect(chain.calls).toContainEqual(['eq', ['trip_id', TRIP]]);
    });

    it('deletes the row and then its files, scoped to the trip', async () => {
        const row = { storage_path: `trips/${TRIP}/original/a.webp`, thumb_path: `trips/${TRIP}/thumbs/a.webp` };
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

    describe('upload pipeline (T-2.2)', () => {
        it('signs an upload for members only', async () => {
            mocks.createUploadTarget.mockResolvedValue({ path: INCOMING, token: 't', signedUrl: 'https://s' });

            const res = await UPLOADS(post('/uploads', { mime_type: 'video/mp4', size: 40 * 1024 * 1024 }), tripCtx);

            expect(res.status).toBe(201);
            expect(mocks.createUploadTarget).toHaveBeenCalledWith({}, TRIP, { mimeType: 'video/mp4', size: 40 * 1024 * 1024 });

            const { AppError } = await import('@/lib/errors');
            mocks.requireTripMember.mockRejectedValueOnce(new AppError('no', 'FORBIDDEN', 403));
            const denied = await UPLOADS(post('/uploads', { mime_type: 'image/jpeg', size: 10 }), tripCtx);
            expect(denied.status).toBe(403);
            expect(mocks.createUploadTarget).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['an unsupported type', { mime_type: 'text/html', size: 10 }],
            ['a file over 50 MB', { mime_type: 'video/mp4', size: 51 * 1024 * 1024 }],
        ])('refuses %s', async (_, body) => {
            const res = await UPLOADS(post('/uploads', body), tripCtx);
            expect(res.status).toBe(400);
            expect(mocks.createUploadTarget).not.toHaveBeenCalled();
        });

        it('confirms: ingests the upload and creates the row with the processed paths', async () => {
            const ingested = {
                storage_path: `trips/${TRIP}/original/b.webp`, thumb_path: `trips/${TRIP}/thumbs/b.webp`,
                mime_type: 'image/webp', size: 1234, width: 640, height: 480,
                metadata: { orientation: 1, dateTaken: '2026-07-14T10:30:00.000Z', gps: { lat: -27.1, lng: -109.3 }, camera: 'TestCam X1' },
            };
            mocks.ingestUpload.mockResolvedValue(ingested);
            chain = queryChain({ data: { id: MEDIA }, error: null });
            mocks.media.mockReturnValue(chain);

            const res = await CONFIRM(post('/confirm', { path: INCOMING }), tripCtx);

            expect(res.status).toBe(201);
            expect(mocks.ingestUpload).toHaveBeenCalledWith({}, TRIP, INCOMING);
            expect(chain.insert.mock.calls[0][0]).toMatchObject({
                trip_id: TRIP, uploaded_by: USER.id,
                storage_path: ingested.storage_path, thumb_path: ingested.thumb_path,
                taken_at: ingested.metadata.dateTaken, gps_lat: -27.1, camera: 'TestCam X1',
            });
        });

        it('removes the processed files if the row cannot be created', async () => {
            const ingested = {
                storage_path: `trips/${TRIP}/original/c.webp`, thumb_path: `trips/${TRIP}/thumbs/c.webp`,
                mime_type: 'image/webp', size: 1, width: 1, height: 1, metadata: { orientation: 1 },
            };
            mocks.ingestUpload.mockResolvedValue(ingested);
            mocks.media.mockReturnValue(queryChain({ data: null, error: { message: 'rls' } }));
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const res = await CONFIRM(post('/confirm', { path: INCOMING }), tripCtx);

            expect(res.status).toBe(500);
            expect(mocks.removeMediaFiles).toHaveBeenCalledWith(TRIP, ingested);
        });

        it('checks the day belongs to the trip before processing', async () => {
            const { AppError } = await import('@/lib/errors');
            mocks.requireDayInTrip.mockRejectedValueOnce(new AppError('Giorno non trovato.', 'NOT_FOUND', 404));

            const res = await CONFIRM(post('/confirm', { path: INCOMING, day_id: '40000000-0000-0000-0000-000000000001' }), tripCtx);

            expect(res.status).toBe(404);
            expect(mocks.ingestUpload).not.toHaveBeenCalled();
        });
    });
});
