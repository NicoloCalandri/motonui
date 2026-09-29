// @vitest-environment node
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZodTypeAny } from 'zod';
import { queryChain } from '@/test/supabase-mock';
import { zodSample } from '@/test/zod-sample';
import { CreateLinkDocumentSchema } from './[id]/documents/schema';

/**
 * Contract tests generated from the route schemas (T-3.8). For every handler
 * under /api/trips/** built with withRoute, three requests:
 * - valid: params, query and body sampled from its Zod schemas pass
 *   validation and authorization (the mocked DB may still answer 404/500);
 * - invalid: a malformed id (and a non-object body) is rejected with 400
 *   before the handler runs;
 * - non-member: a caller outside the trip gets 403.
 */

const USER = { id: '00000000-0000-4000-8000-00000000000a', email: 'nicolo@example.com' };

const mocks = vi.hoisted(() => ({ requireTripMember: vi.fn(), from: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase/server', () => {
    const client = () => ({
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: mocks.from,
        rpc: mocks.rpc,
        storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'mock' } }) }) },
    });
    return { createClient: vi.fn(async () => client()), createAdminClient: vi.fn(async () => client()) };
});
vi.mock('@/lib/authz', () => ({
    requireTripMember: mocks.requireTripMember,
    requireDayInTrip: vi.fn(async () => undefined),
    requireLegInTrip: vi.fn(async () => undefined),
    requireTripPayer: vi.fn(async () => undefined),
}));
vi.mock('@/lib/email', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/email')>()),
    sendEmail: vi.fn(async () => undefined),
}));
vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    after: vi.fn(),
}));

type RouteConfig = { name: string; params?: ZodTypeAny; query?: ZodTypeAny; body?: ZodTypeAny; tripMember?: boolean };

/**
 * Valid bodies the schemas cannot express: a `refine` on the MIME type, a
 * path the server built, a body chosen by content type inside the handler.
 */
const VALID_BODIES: Record<string, (params: Record<string, string>) => unknown> = {
    'trips/[id]/media/uploads POST': () => ({ mime_type: 'image/jpeg', size: 1024 }),
    'trips/[id]/media/confirm POST': ({ id }) => ({ path: `trips/${id}/incoming/10000000-0000-4000-8000-00000000000b.jpg` }),
    'trips/[id]/documents POST': () => zodSample(CreateLinkDocumentSchema),
};
type Handler = ((request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>) & { route?: RouteConfig };

const ROOT = join(process.cwd(), 'src/app/api/trips');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return routeFiles(path);
        return entry.name === 'route.ts' ? [path] : [];
    });
}

const files = routeFiles(ROOT);
const modules = await Promise.all(files.map(async (file) => [relative(process.cwd(), file), (await import(file)) as Record<string, unknown>] as const));
const handlers = modules.flatMap(([file, mod]) =>
    METHODS.filter((method) => typeof mod[method] === 'function').map((method) => ({ file, method, handler: mod[method] as Handler })),
);

function request(method: string, route: RouteConfig, body?: unknown): Request {
    const url = new URL('http://localhost/api/trips/x');
    if (route.query) {
        for (const [key, value] of Object.entries(zodSample(route.query) as Record<string, unknown>)) url.searchParams.set(key, String(value));
    }
    const hasBody = method !== 'GET' && method !== 'DELETE';
    return new Request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: hasBody ? JSON.stringify(body ?? (route.body ? zodSample(route.body) : {})) : undefined,
    });
}

function context(params: unknown) {
    return { params: Promise.resolve(params as Record<string, string>) };
}

describe('trip route contracts (T-3.8)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in contract tests'); }));
        mocks.requireTripMember.mockResolvedValue(undefined);
        mocks.from.mockImplementation(() => queryChain({ data: null, error: null }));
        mocks.rpc.mockResolvedValue({ data: null, error: null });
    });
    afterAll(() => vi.unstubAllGlobals());

    it('covers every trip route, all built with withRoute', () => {
        expect(files.length).toBeGreaterThan(30);
        expect(handlers.filter(({ handler }) => !handler.route).map(({ file, method }) => `${file} ${method}`)).toEqual([]);
    });

    describe.each(handlers.map((h) => [`${h.file.replace('src/app/api/trips', '')} ${h.method}`, h] as const))('%s', (_label, { method, handler }) => {
        const route = handler.route as RouteConfig;
        const params = route.params ? zodSample(route.params) : {};

        const validBody = VALID_BODIES[route.name]?.(params as Record<string, string>);

        it('samples valid input from its schemas', () => {
            if (route.params) expect(route.params.safeParse(params).success).toBe(true);
            if (route.body) expect(route.body.safeParse(validBody ?? zodSample(route.body)).success).toBe(true);
            if (route.query) expect(route.query.safeParse(zodSample(route.query)).success).toBe(true);
        });

        it('valid: passes validation and authorization', async () => {
            const res = await handler(request(method, route, validBody), context(params));
            expect([400, 401, 403]).not.toContain(res.status);
        });

        it('invalid: rejects malformed input with 400', async () => {
            if (route.params) {
                const res = await handler(request(method, route), context({ ...(params as object), id: 'not-a-uuid' }));
                expect(res.status).toBe(400);
                expect(mocks.requireTripMember).not.toHaveBeenCalled();
            }
            if (route.body) {
                const res = await handler(request(method, route, ['not', 'an', 'object']), context(params));
                expect(res.status).toBe(400);
            }
            if (!route.params && !route.body) {
                // GET /api/trips: no input at all, only the session (covered by the middleware tests).
                expect(route.query).toBeUndefined();
            }
        });

        it('non-member: answers 403', async () => {
            if (!route.tripMember) return;
            const { Errors } = await import('@/lib/errors');
            mocks.requireTripMember.mockRejectedValueOnce(Errors.forbidden());
            const res = await handler(request(method, route), context(params));
            expect(res.status).toBe(403);
            expect(mocks.from).not.toHaveBeenCalled();
        });
    });
});
