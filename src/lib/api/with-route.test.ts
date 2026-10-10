// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mockGetUser = vi.fn();
const supabaseClient = { auth: { getUser: mockGetUser }, from: vi.fn() };
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => supabaseClient) }));

const mockRequireTripMember = vi.fn();
const mockRequireDayInTrip = vi.fn();
vi.mock('@/lib/authz', () => ({
    requireTripMember: mockRequireTripMember,
    requireDayInTrip: mockRequireDayInTrip,
}));

const TRIP = '11111111-1111-1111-1111-111111111111';
const DAY = '22222222-2222-2222-2222-222222222222';
const USER = { id: '33333333-3333-3333-3333-333333333333' };

const ParamsSchema = z.object({ id: z.string().uuid(), dayId: z.string().uuid() });

function ctx(params: Record<string, string>) {
    return { params: Promise.resolve(params) } as { params: Promise<{ id: string; dayId: string }> };
}

async function json(res: Response) {
    return res.json() as Promise<{ error?: string; code?: string; status?: number }>;
}

describe('withRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: USER } });
        mockRequireTripMember.mockResolvedValue(undefined);
        mockRequireDayInTrip.mockResolvedValue(undefined);
    });

    it('returns 401 before running any check or the handler', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const handler = vi.fn();
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema, tripMember: true }, handler);

        const res = await route(new Request('http://x/'), ctx({ id: TRIP, dayId: DAY }));

        expect(res.status).toBe(401);
        expect(mockRequireTripMember).not.toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
    });

    it('rejects invalid params with a readable 400', async () => {
        const handler = vi.fn();
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema, tripMember: true }, handler);

        const res = await route(new Request('http://x/'), ctx({ id: 'not-a-uuid', dayId: DAY }));

        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe('Dati non validi: id: formato non valido');
        expect(handler).not.toHaveBeenCalled();
    });

    it('checks trip membership with the parsed trip id', async () => {
        const { AppError } = await import('@/lib/errors');
        mockRequireTripMember.mockRejectedValue(new AppError('no', 'FORBIDDEN', 403));
        const handler = vi.fn();
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema, tripMember: true }, handler);

        const res = await route(new Request('http://x/'), ctx({ id: TRIP, dayId: DAY }));

        expect(mockRequireTripMember).toHaveBeenCalledWith(supabaseClient, TRIP, USER.id);
        expect(res.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
    });

    it('turns a day of another trip into 404', async () => {
        const { Errors } = await import('@/lib/errors');
        mockRequireDayInTrip.mockRejectedValue(Errors.validation('altro viaggio'));
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema, tripMember: true, dayInTrip: true }, vi.fn());

        const res = await route(new Request('http://x/'), ctx({ id: TRIP, dayId: DAY }));

        expect(mockRequireDayInTrip).toHaveBeenCalledWith(supabaseClient, TRIP, DAY);
        expect(res.status).toBe(404);
    });

    it('validates query and body and passes typed values to the handler', async () => {
        const { withRoute } = await import('./with-route');
        const { ok } = await import('@/lib/errors');
        const handler = vi.fn(async ({ query, body, params, user }) => ok({ query, body, params, user }));
        const route = withRoute({
            name: 't',
            params: ParamsSchema,
            query: z.object({ limit: z.coerce.number().int().max(50) }),
            body: z.object({ title: z.string().min(1) }),
            tripMember: true,
        }, handler);

        const res = await route(
            new Request('http://x/?limit=10', { method: 'POST', body: JSON.stringify({ title: 'Ciao' }) }),
            ctx({ id: TRIP, dayId: DAY }),
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            query: { limit: 10 },
            body: { title: 'Ciao' },
            params: { id: TRIP, dayId: DAY },
            user: USER,
        });
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('rejects an invalid body and malformed JSON with 400', async () => {
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema, body: z.object({ title: z.string() }) }, vi.fn());

        const bad = await route(new Request('http://x/', { method: 'POST', body: '{}' }), ctx({ id: TRIP, dayId: DAY }));
        expect(bad.status).toBe(400);
        expect((await json(bad)).error).toBe('Dati non validi: title: campo obbligatorio');

        const malformed = await route(new Request('http://x/', { method: 'POST', body: '{' }), ctx({ id: TRIP, dayId: DAY }));
        expect(malformed.status).toBe(400);
    });

    it('keeps an explicit Cache-Control set by the handler', async () => {
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema }, async () =>
            new Response('x', { headers: { 'Cache-Control': 'public, max-age=60' } }),
        );
        const res = await route(new Request('http://x/'), ctx({ id: TRIP, dayId: DAY }));
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    });

    it('hides unexpected errors behind a generic 500', async () => {
        const { withRoute } = await import('./with-route');
        const route = withRoute({ name: 't', params: ParamsSchema }, async () => {
            throw new Error('db exploded: secret detail');
        });
        const res = await route(new Request('http://x/'), ctx({ id: TRIP, dayId: DAY }));
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('secret detail');
    });
});
