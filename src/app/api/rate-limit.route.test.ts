// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain } from '@/test/supabase-mock';

/**
 * T-4.5 acceptance: over the limit a route answers 429 with Retry-After and
 * does no work. Public route keyed by IP, signed-in route keyed by user.
 */

const USER = { id: '00000000-0000-4000-8000-00000000000a' };
const TRIP = '10000000-0000-4000-8000-00000000000a';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) }, from: mocks.from })),
    createAdminClient: vi.fn(async () => ({ rpc: mocks.rpc, from: mocks.from })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: vi.fn(async () => undefined), requireDayInTrip: vi.fn() }));

import { GET as getPost } from './posts/[slug]/route';
import { POST as requestUpload } from './trips/[id]/media/uploads/route';

function overLimit() {
    const resetAt = new Date(Date.now() + 42_000).toISOString();
    mocks.rpc.mockResolvedValue({ data: [{ allowed: false, hits: 999, reset_at: resetAt }], error: null });
}

describe('rate limiting on routes (T-4.5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.from.mockImplementation(() => queryChain({ data: null, error: null }));
    });

    it('public post: 429 per IP over the limit, before any query', async () => {
        overLimit();
        const res = await getPost(
            new Request('http://localhost/api/posts/rapa-nui', { headers: { 'x-forwarded-for': '203.0.113.7' } }),
            { params: Promise.resolve({ slug: 'rapa-nui' }) },
        );

        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429 });
        expect(Number(res.headers.get('retry-after'))).toBeGreaterThanOrEqual(41);
        const [, args] = mocks.rpc.mock.calls[0];
        expect(args.p_key).toMatch(/^ip:[0-9a-f]{32}:publicPost$/);
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('upload: 429 per user over the limit, before validation and storage', async () => {
        overLimit();
        const res = await requestUpload(
            new Request(`http://localhost/api/trips/${TRIP}/media/uploads`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ mime_type: 'image/jpeg', size: 1024 }),
            }),
            { params: Promise.resolve({ id: TRIP }) },
        );

        expect(res.status).toBe(429);
        expect(res.headers.get('retry-after')).toBeTruthy();
        expect(mocks.rpc.mock.calls[0][1].p_key).toBe(`user:${USER.id}:mediaUpload`);
    });

    it('lets the request through under the limit', async () => {
        mocks.rpc.mockResolvedValue({ data: [{ allowed: true, hits: 1, reset_at: new Date().toISOString() }], error: null });
        const res = await getPost(new Request('http://localhost/api/posts/rapa-nui'), { params: Promise.resolve({ slug: 'rapa-nui' }) });
        expect(res.status).toBe(404); // reached the handler: no such post in the mock
    });
});
