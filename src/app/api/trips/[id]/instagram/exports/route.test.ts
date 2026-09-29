// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain, type QueryChain } from '@/test/supabase-mock';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const EXPORT = '50000000-0000-0000-0000-000000000001';
const MEDIA = ['30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002'];
const USER = { id: '00000000-0000-0000-0000-00000000000a' };

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    tables: vi.fn(),
    requireTripMember: vi.fn(),
    requireFeatureAccess: vi.fn(),
    generateExport: vi.fn(),
    adminUpdate: vi.fn(),
    createSignedUrl: vi.fn(),
    afterCallbacks: [] as Array<() => Promise<void>>,
}));

vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    after: (callback: () => Promise<void>) => { mocks.afterCallbacks.push(callback); },
}));
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser }, from: mocks.tables })),
    createAdminClient: vi.fn(async () => ({
        from: vi.fn(() => ({ update: (values: object) => ({ eq: async () => mocks.adminUpdate(values) }) })),
        storage: { from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })) },
    })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: mocks.requireTripMember, requireDayInTrip: vi.fn() }));
vi.mock('@/lib/premium/access', () => ({ requireFeatureAccess: mocks.requireFeatureAccess }));
vi.mock('@/lib/media/instagram-export', () => ({
    generateExport: mocks.generateExport,
    exportZipPath: (trip: string, id: string) => `${trip}/${id}.zip`,
}));

import { POST } from './route';
import { GET as STATUS } from './[exportId]/route';
import { AppError } from '@/lib/errors';

const tripCtx = { params: Promise.resolve({ id: TRIP }) };
const statusCtx = { params: Promise.resolve({ id: TRIP, exportId: EXPORT }) };

function post(body: unknown) {
    return new Request(`http://localhost/api/trips/${TRIP}/instagram/exports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

let running: QueryChain;
let insert: QueryChain;

describe('instagram exports (T-2.7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.afterCallbacks.length = 0;
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getUser.mockResolvedValue({ data: { user: USER } });
        mocks.requireTripMember.mockResolvedValue(undefined);
        running = queryChain({ data: null, error: null });
        Object.assign(running, { then: (resolve: (v: unknown) => unknown) => Promise.resolve({ count: 0 }).then(resolve) });
        insert = queryChain({ data: { id: EXPORT, status: 'processing', expires_at: 'x' }, error: null });
        // mockReset: clearAllMocks keeps queued once-values of tests that never read them.
        mocks.tables.mockReset().mockReturnValueOnce(running).mockReturnValueOnce(insert);
    });

    it('answers 202 right away and processes the photos after the response', async () => {
        mocks.generateExport.mockResolvedValue({ zipPath: `${TRIP}/${EXPORT}.zip`, slideCount: 2 });

        const res = await POST(post({ mediaIds: MEDIA, format: 'carousel' }), tripCtx);

        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ id: EXPORT, status: 'processing' });
        expect(mocks.generateExport).not.toHaveBeenCalled();

        await mocks.afterCallbacks[0]();
        expect(mocks.generateExport).toHaveBeenCalledWith(expect.objectContaining({ tripId: TRIP, exportId: EXPORT, mediaIds: MEDIA }));
        expect(mocks.adminUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready', zip_path: `${TRIP}/${EXPORT}.zip` }));
    });

    it('marks the job failed with a user-facing message when processing fails', async () => {
        mocks.generateExport.mockRejectedValue(new AppError('Nessuna foto esportabile', 'MEDIA_NOT_EXPORTABLE', 400));

        await POST(post({ mediaIds: MEDIA, format: 'story' }), tripCtx);
        await mocks.afterCallbacks[0]();

        expect(mocks.adminUpdate).toHaveBeenCalledWith({ status: 'failed', error: 'Nessuna foto esportabile' });
    });

    it.each([
        ['an SVG-breaking color', { textOverlay: { text: 'Ciao', color: '"/><image href="file:///etc/passwd"/>' } }],
        ['too many photos', { mediaIds: Array.from({ length: 11 }, () => MEDIA[0]) }],
        ['an unknown format', { format: 'reel' }],
        ['a non-uuid media id', { mediaIds: ['../x'] }],
    ])('rejects %s', async (_, overrides) => {
        const res = await POST(post({ mediaIds: MEDIA, format: 'carousel', ...overrides }), tripCtx);
        expect(res.status).toBe(400);
        expect(insert.insert).not.toHaveBeenCalled();
    });

    it('refuses a second export while one is running', async () => {
        Object.assign(running, { then: (resolve: (v: unknown) => unknown) => Promise.resolve({ count: 1 }).then(resolve) });
        const res = await POST(post({ mediaIds: MEDIA, format: 'carousel' }), tripCtx);
        expect(res.status).toBe(429);
        expect(insert.insert).not.toHaveBeenCalled();
    });

    it('returns a signed URL limited to the remaining lifetime of a ready ZIP', async () => {
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        mocks.tables.mockReset().mockReturnValue(queryChain({
            data: { id: EXPORT, trip_id: TRIP, type: 'carousel', status: 'ready', created_at: new Date().toISOString(), expires_at: expires, zip_path: `${TRIP}/${EXPORT}.zip`, caption: 'Rapa Nui', hashtags: ['#viaggio'], error: null },
            error: null,
        }));
        mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/zip' }, error: null });

        const res = await STATUS(new Request('http://localhost'), statusCtx);
        const body = await res.json();

        expect(body).toMatchObject({ status: 'ready', download_url: 'https://signed/zip', caption: 'Rapa Nui' });
        const [path, seconds] = mocks.createSignedUrl.mock.calls[0];
        expect(path).toBe(`${TRIP}/${EXPORT}.zip`);
        expect(seconds).toBeLessThanOrEqual(3600);
        expect(seconds).toBeGreaterThan(3500);
    });

    it('never signs a zip_path that is not this export of this trip', async () => {
        mocks.tables.mockReset().mockReturnValue(queryChain({
            data: { id: EXPORT, trip_id: TRIP, type: 'carousel', status: 'ready', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(), zip_path: 'another-trip/secret.zip', caption: null, hashtags: null, error: null },
            error: null,
        }));

        const body = await (await STATUS(new Request('http://localhost'), statusCtx)).json();

        expect(body).toMatchObject({ status: 'failed', download_url: null });
        expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    });

    it('reports a job stuck in processing as failed', async () => {
        mocks.tables.mockReset().mockReturnValue(queryChain({
            data: { id: EXPORT, trip_id: TRIP, type: 'carousel', status: 'processing', created_at: new Date(Date.now() - 10 * 60_000).toISOString(), expires_at: null, zip_path: null, caption: null, hashtags: null, error: null },
            error: null,
        }));

        const body = await (await STATUS(new Request('http://localhost'), statusCtx)).json();

        expect(body.status).toBe('failed');
        expect(body.error).toBeTruthy();
    });
});
