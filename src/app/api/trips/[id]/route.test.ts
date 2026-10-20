// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) =>
            new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
    },
}));

const TRIP = '11111111-1111-1111-1111-111111111111';
const USER = { id: '55555555-5555-5555-5555-555555555555' };

const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: USER } })) },
        from: vi.fn(() => {
            const chain = { eq: vi.fn(), single: mockSingle };
            chain.eq.mockReturnValue(chain);
            mockSelect.mockReturnValue(chain);
            return { select: mockSelect };
        }),
    })),
}));
vi.mock('@/lib/authz', () => ({ requireTripMember: vi.fn(async () => undefined) }));

const params = { params: Promise.resolve({ id: TRIP }) };

describe('GET /api/trips/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the travellers as `members`, the name the pages and TripWithDetails use', async () => {
        const members = [{ id: 'm1', user_id: USER.id, role: 'owner' }];
        mockSingle.mockResolvedValue({ data: { id: TRIP, title: 'Rapa Nui', members }, error: null });
        const { GET } = await import('./route');

        const res = await GET(new Request(`https://motonui.app/api/trips/${TRIP}`), params);

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ members });
        // PostgREST alias: without it the rows come back as `trip_members`
        // and the page shows "undefined persone".
        const columns = String(mockSelect.mock.calls[0][0]).replace(/\s+/g, ' ');
        expect(columns).toContain('members:trip_members ( id, user_id, role )');
    });

    it('answers 404 when the trip cannot be read', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
        const { GET } = await import('./route');

        const res = await GET(new Request(`https://motonui.app/api/trips/${TRIP}`), params);

        expect(res.status).toBe(404);
    });
});
