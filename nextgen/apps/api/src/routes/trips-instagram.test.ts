import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Instagram export as a job: POST answers 202 at once, the ZIP is built after
 * the response, and the client polls the job for a signed link (counterpart
 * of src/app/api/trips/[id]/instagram/exports/**).
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const JOB = '60000000-0000-4000-8000-000000000001';
const MEDIA = '70000000-0000-4000-8000-000000000001';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };
const DAY_MS = 24 * 60 * 60 * 1000;

type Write = { op: string; payload: Record<string, unknown>; admin: boolean };

const state = vi.hoisted(() => ({
    writes: [] as Array<{ op: string; payload: Record<string, unknown>; admin: boolean }>,
    running: 0,
    job: null as Record<string, unknown> | null,
    signed: [] as Array<{ path: string; seconds: number }>,
}));
const mocks = vi.hoisted(() => ({ generateExport: vi.fn(), requireFeatureAccess: vi.fn(), captureError: vi.fn() }));

function stubClient(admin: boolean) {
    const builder = (table: string) => {
        let head = false;
        const chain: Record<string, unknown> = {};
        chain.select = (_columns?: string, options?: { head?: boolean }) => {
            head = Boolean(options?.head);
            return chain;
        };
        for (const method of ['eq', 'gt', 'order', 'limit', 'in']) chain[method] = () => chain;
        for (const op of ['insert', 'update']) {
            chain[op] = (payload: Record<string, unknown>) => {
                if (table === 'instagram_exports') state.writes.push({ op, payload, admin });
                return chain;
            };
        }
        const guard = { id: JOB, trip_id: TRIP, user_id: USER.id, owner_id: USER.id, role: 'user', suspended_at: null, status: 'processing', expires_at: null };
        const row = () => (table === 'instagram_exports' && state.job !== null ? state.job : guard);
        chain.single = async () => ({ data: row(), error: null });
        chain.maybeSingle = async () => ({ data: table === 'instagram_exports' ? state.job : guard, error: null });
        chain.then = (resolve: (value: unknown) => unknown) =>
            Promise.resolve(head ? { count: state.running, error: null } : { data: [row()], error: null }).then(resolve);
        return chain;
    };
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: builder,
        rpc: async () => ({ data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null }),
        storage: {
            from: () => ({
                createSignedUrl: async (path: string, seconds: number) => {
                    state.signed.push({ path, seconds });
                    return { data: { signedUrl: 'https://signed.example/zip' }, error: null };
                },
            }),
        },
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(false),
    createAnonClient: () => stubClient(false),
    createAdminClient: () => stubClient(true),
}));
vi.mock('../lib/media/instagram-export', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/media/instagram-export')>()),
    generateExport: mocks.generateExport,
}));
vi.mock('../lib/premium/access', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/premium/access')>()),
    requireFeatureAccess: mocks.requireFeatureAccess,
}));
vi.mock('../lib/monitoring', () => ({ captureError: mocks.captureError }));

import { createApp } from '../app';
import { backgroundIdle } from '../lib/background';
import { AppError } from '../lib/errors';

function call(method: string, path: string, body?: Record<string, unknown>) {
    const headers: Record<string, string> = { authorization: 'Bearer test-token' };
    const init: RequestInit = { method, headers };
    if (body) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    return createApp().request(path, init);
}

const base = `/api/trips/${TRIP}/instagram/exports`;
const valid = { mediaIds: [MEDIA], format: 'carousel' };
const written = (op: string): Write[] => state.writes.filter((write) => write.op === op);

beforeEach(async () => {
    await backgroundIdle();
    vi.clearAllMocks();
    state.writes = [];
    state.running = 0;
    state.job = null;
    state.signed = [];
    mocks.generateExport.mockResolvedValue({ zipPath: `${TRIP}/${JOB}.zip`, slideCount: 1 });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/trips/:id/instagram/exports', () => {
    it('answers 202 with the job before the ZIP exists', async () => {
        let release = () => {};
        mocks.generateExport.mockReturnValue(new Promise((resolve) => {
            release = () => resolve({ zipPath: `${TRIP}/${JOB}.zip`, slideCount: 1 });
        }));

        const res = await call('POST', base, valid);

        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ id: JOB });
        expect(written('update')).toEqual([]);
        release();
        await backgroundIdle();
    });

    it('creates the job as processing, owned by the caller, expiring in 24 hours', async () => {
        const before = Date.now();

        await call('POST', base, { ...valid, filter: 'warm' });

        const [{ payload, admin }] = written('insert');
        expect(admin).toBe(false);
        expect(payload).toMatchObject({ trip_id: TRIP, created_by: USER.id, type: 'carousel', media_ids: [MEDIA], status: 'processing' });
        expect(payload.options).toEqual({ filter: 'warm', textOverlay: null, language: 'it' });
        const expires = Date.parse(String(payload.expires_at));
        expect(expires).toBeGreaterThanOrEqual(before + DAY_MS);
        expect(expires).toBeLessThanOrEqual(Date.now() + DAY_MS);
    });

    it('marks the job ready with the ZIP path once the export is built', async () => {
        mocks.generateExport.mockResolvedValue({ zipPath: `${TRIP}/${JOB}.zip`, slideCount: 1, captionResult: { caption: 'Rapa Nui', hashtags: ['#motonui'] } });

        await call('POST', base, valid);
        await backgroundIdle();

        expect(mocks.generateExport.mock.calls[0][0]).toMatchObject({ exportId: JOB, tripId: TRIP, mediaIds: [MEDIA], format: 'carousel', filter: 'none', language: 'it' });
        expect(written('update')).toEqual([{ op: 'update', admin: true, payload: { status: 'ready', zip_path: `${TRIP}/${JOB}.zip`, caption: 'Rapa Nui', hashtags: ['#motonui'] } }]);
    });

    it('marks the job failed with a generic message when the export breaks', async () => {
        mocks.generateExport.mockRejectedValue(new Error('sharp: relation "secret_table" does not exist'));

        const res = await call('POST', base, valid);
        await backgroundIdle();

        expect(res.status).toBe(202);
        const [{ payload }] = written('update');
        expect(payload.status).toBe('failed');
        expect(String(payload.error)).not.toContain('secret_table');
        expect(String(payload.error)).toContain('🏝️');
    });

    it('keeps the message of an expected failure', async () => {
        mocks.generateExport.mockRejectedValue(new AppError('Nessuna foto da esportare 🏝️', 'NO_SLIDES', 400));

        await call('POST', base, valid);
        await backgroundIdle();

        expect(written('update')[0].payload).toEqual({ status: 'failed', error: 'Nessuna foto da esportare 🏝️' });
    });

    it('refuses a second export while one is running for the trip', async () => {
        state.running = 1;

        const res = await call('POST', base, valid);

        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({ code: 'EXPORT_RUNNING' });
        expect(written('insert')).toEqual([]);
        expect(mocks.generateExport).not.toHaveBeenCalled();
    });

    it('checks the caption quota before creating the job', async () => {
        mocks.requireFeatureAccess.mockRejectedValue(new AppError('Limite raggiunto', 'QUOTA_EXCEEDED', 429));

        const res = await call('POST', base, { ...valid, generateCaption: true });

        expect(res.status).toBe(429);
        expect(mocks.requireFeatureAccess).toHaveBeenCalledWith({ userId: USER.id, feature: 'instagram_caption', allowAdminBypass: true });
        expect(written('insert')).toEqual([]);
    });

    it('does not touch the quota when no caption is asked', async () => {
        await call('POST', base, valid);

        expect(mocks.requireFeatureAccess).not.toHaveBeenCalled();
    });

    it.each([
        ['no photos', { ...valid, mediaIds: [] }],
        ['more photos than a carousel holds', { ...valid, mediaIds: Array.from({ length: 11 }, () => MEDIA) }],
        ['an unknown format', { ...valid, format: 'reel' }],
        ['a colour that is not a hex code', { ...valid, textOverlay: { text: 'Ciao', color: 'red;}</style><script>' } }],
        ['an overlay text over 120 characters', { ...valid, textOverlay: { text: 'a'.repeat(121) } }],
        ['a photo id that is not a UUID', { ...valid, mediaIds: ['abc'] }],
    ])('refuses %s', async (_label, body) => {
        const res = await call('POST', base, body);

        expect(res.status).toBe(400);
        expect(written('insert')).toEqual([]);
    });
});

describe('GET /api/trips/:id/instagram/exports/:exportId', () => {
    const job = (overrides: Record<string, unknown> = {}) => ({
        id: JOB, trip_id: TRIP, type: 'carousel', status: 'ready', created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), zip_path: `${TRIP}/${JOB}.zip`,
        caption: null, hashtags: null, error: null, ...overrides,
    });
    const poll = async () => {
        const res = await call('GET', `${base}/${JOB}`);
        return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };

    it('returns a signed link that does not outlive the ZIP', async () => {
        state.job = job();

        const { body } = await poll();

        expect(body).toMatchObject({ status: 'ready', download_url: 'https://signed.example/zip', hashtags: [] });
        expect(state.signed[0].path).toBe(`${TRIP}/${JOB}.zip`);
        expect(state.signed[0].seconds).toBeGreaterThan(3500);
        expect(state.signed[0].seconds).toBeLessThanOrEqual(3600);
    });

    it('never signs for more than 24 hours', async () => {
        state.job = job({ expires_at: new Date(Date.now() + 3 * DAY_MS).toISOString() });

        await poll();

        expect(state.signed[0].seconds).toBe(24 * 60 * 60);
    });

    it.each([
        ['another trip', '20000000-0000-4000-8000-00000000000b/60000000-0000-4000-8000-000000000001.zip'],
        ['another export', `${TRIP}/70000000-0000-4000-8000-000000000009.zip`],
        ['nothing', null],
    ])('signs nothing when the stored path points to %s', async (_label, zip_path) => {
        state.job = job({ zip_path });

        const { body } = await poll();

        expect(state.signed).toEqual([]);
        expect(body).toMatchObject({ status: 'failed', download_url: null });
    });

    it('reports an expired ZIP as failed', async () => {
        state.job = job({ expires_at: new Date(Date.now() - 1000).toISOString() });

        const { body } = await poll();

        expect(state.signed).toEqual([]);
        expect(body).toMatchObject({ status: 'failed', download_url: null });
    });

    it('reports a job stuck in processing as failed', async () => {
        state.job = job({ status: 'processing', zip_path: null, created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() });

        const { body } = await poll();

        expect(body.status).toBe('failed');
        expect(String(body.error)).toContain('🏝️');
    });

    it('reports a recent job as still processing, with no link', async () => {
        state.job = job({ status: 'processing', zip_path: null });

        const { body } = await poll();

        expect(body).toMatchObject({ status: 'processing', error: null, download_url: null });
    });

    it('answers 404 for a job that is not in this trip', async () => {
        const res = await call('GET', `${base}/${JOB}`);

        expect(res.status).toBe(404);
    });
});

describe('the old synchronous export', () => {
    it('is gone', async () => {
        const res = await call('POST', '/api/instagram/generate', { tripId: TRIP, mediaIds: [MEDIA], type: 'carousel' });

        expect(res.status).toBe(404);
        expect(mocks.generateExport).not.toHaveBeenCalled();
    });
});

describe('GET /api/trips/:id/instagram/exports', () => {
    it('lists the recent exports of the trip', async () => {
        state.job = { id: JOB, type: 'carousel', status: 'ready' };

        const res = await call('GET', base);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([state.job]);
    });
});
