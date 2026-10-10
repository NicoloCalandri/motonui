import { beforeEach, describe, expect, it, vi } from 'vitest';

const TRIP = '10000000-0000-4000-8000-00000000000a';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

/** The caller is signed in and a member of every trip; only the limiter varies. */
function stubClient() {
    const chain: Record<string, unknown> = {};
    const row = { data: { trip_id: 'x', role: 'user', suspended_at: null }, error: null };
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) chain[method] = () => chain;
    chain.single = async () => row;
    chain.maybeSingle = async () => row;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return { auth: { getUser: async () => ({ data: { user: USER } }) }, from: () => chain, rpc: mocks.rpc, storage: { from: () => ({}) } };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';
import { RATE_LIMITS } from '../lib/rate-limit';

const OVER = { data: [{ allowed: false, hits: 999, reset_at: new Date(Date.now() + 30_000).toISOString() }], error: null };
const UNDER = { data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 30_000).toISOString() }], error: null };

function call(method: string, path: string, headers: Record<string, string> = {}) {
    const init: RequestInit = { method, headers: { authorization: 'Bearer test-token', ...headers } };
    if (method === 'POST') {
        (init.headers as Record<string, string>)['content-type'] = 'application/json';
        init.body = '{}';
    }
    return createApp().request(path, init);
}

// Route → bucket, mirroring `rateLimit: '<bucket>'` on the Next.js routes.
const LIMITED: Array<[string, string, keyof typeof RATE_LIMITS, 'user' | 'ip']> = [
    ['POST', '/api/ai/blog', 'ai', 'user'],
    ['POST', '/api/ai/destination', 'ai', 'user'],
    ['POST', '/api/ai/generate-post', 'ai', 'user'],
    ['POST', '/api/instagram/generate', 'instagramExport', 'user'],
    ['POST', `/api/trips/${TRIP}/media`, 'mediaUpload', 'user'],
    ['POST', `/api/trips/${TRIP}/documents`, 'fileUpload', 'user'],
    ['POST', '/api/profile/avatar', 'fileUpload', 'user'],
    ['GET', '/api/posts/some-slug', 'publicPost', 'ip'],
];

describe('rate limiting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe.each(LIMITED)('%s %s', (method, path, bucket, kind) => {
        it(`answers 429 with Retry-After over the ${bucket} limit`, async () => {
            mocks.rpc.mockResolvedValue(OVER);

            const res = await call(method, path, { 'x-forwarded-for': '203.0.113.9' });

            expect(res.status).toBe(429);
            expect(await res.json()).toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429 });
            expect(Number(res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
        });

        it('counts the hit in the right bucket, keyed without the raw IP', async () => {
            mocks.rpc.mockResolvedValue(OVER);

            await call(method, path, { 'x-forwarded-for': '203.0.113.9' });

            const [fn, args] = mocks.rpc.mock.calls[0] as [string, { p_key: string; p_limit: number; p_window_seconds: number }];
            expect(fn).toBe('check_rate_limit');
            expect(args.p_limit).toBe(RATE_LIMITS[bucket].limit);
            expect(args.p_window_seconds).toBe(RATE_LIMITS[bucket].windowSeconds);
            expect(args.p_key).toMatch(kind === 'user' ? new RegExp(`^user:${USER.id}:${bucket}$`) : new RegExp(`^ip:[0-9a-f]{32}:${bucket}$`));
            expect(args.p_key).not.toContain('203.0.113.9');
        });
    });

    it('lets the request through when the counter is unavailable, and logs it', async () => {
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

        const res = await call('GET', '/api/posts/some-slug');

        expect(res.status).not.toBe(429);
        expect(errorLog.mock.calls.some(([line]) => String(line).includes('rate-limit'))).toBe(true);
    });

    it.each([
        ['GET', `/api/trips/${TRIP}/media`],
        ['GET', `/api/trips/${TRIP}/documents`],
        ['GET', '/api/profile'],
    ])('does not count %s %s', async (method, path) => {
        mocks.rpc.mockResolvedValue(UNDER);
        await call(method, path);
        expect(mocks.rpc).not.toHaveBeenCalled();
    });
});
