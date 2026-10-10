import type { z, ZodTypeAny } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, type AuthUser } from '@/lib/auth/get-user';
import { AppError, Errors, withErrorHandler } from '@/lib/errors';
import { requireDayInTrip, requireTripMember } from '@/lib/authz';
import { formatZodError } from '@/lib/validation';
import { enforceRateLimit, userSubject, type RateLimitBucket } from '@/lib/rate-limit';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type Parsed<S> = S extends ZodTypeAny ? z.output<S> : undefined;

/** Raw route params as Next.js passes them (all strings). */
type RawParams<S> = S extends ZodTypeAny ? { [K in keyof z.input<S>]: string } : Record<string, never>;

export interface RouteConfig<P, Q, B> {
    /** Log label, e.g. `trips/[id]/days GET`. */
    name: string;
    params?: P;
    query?: Q;
    body?: B;
    /** Requires the caller to be a member of the trip in `params.id`. */
    tripMember?: boolean;
    /** Requires `params.dayId`, when present, to belong to the trip in `params.id`. */
    dayInTrip?: boolean;
    /** Per-user rate limit bucket (T-4.5): 429 with Retry-After over the limit. */
    rateLimit?: RateLimitBucket;
}

/** A route handler built by withRoute, carrying its config. */
export type RouteHandler<P, Q, B> = ((request: Request, context: { params: Promise<RawParams<P>> }) => Promise<Response>) & {
    route: RouteConfig<P, Q, B>;
};

export interface RouteContext<P, Q, B> {
    request: Request;
    supabase: SupabaseServerClient;
    user: AuthUser;
    params: Parsed<P>;
    query: Parsed<Q>;
    body: Parsed<B>;
}

function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
    const result = schema.safeParse(value);
    if (!result.success) throw Errors.validation(formatZodError(result.error));
    return result.data;
}

async function readJson(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        throw Errors.validation('corpo della richiesta non valido (JSON atteso)');
    }
}

/**
 * Single entry point for authenticated API routes (T-1.3): error handling,
 * authentication, Zod validation of params/query/body, trip membership and
 * day-in-trip checks, and `Cache-Control: private, no-store` on the response.
 *
 * The handler only runs once every check has passed, with typed inputs.
 */
export function withRoute<
    P extends ZodTypeAny | undefined = undefined,
    Q extends ZodTypeAny | undefined = undefined,
    B extends ZodTypeAny | undefined = undefined,
>(
    config: RouteConfig<P, Q, B>,
    handler: (ctx: RouteContext<P, Q, B>) => Promise<Response>,
): RouteHandler<P, Q, B> {
    const wrapped = withErrorHandler(async (request, context) => {
        const supabase = await createClient();
        const user = await getAuthUser(supabase);
        if (config.rateLimit) {
            await enforceRateLimit(config.rateLimit, userSubject(user.id));
        }

        const rawParams = await context.params;
        const params = (config.params ? parseOrThrow(config.params, rawParams) : undefined) as Parsed<P>;

        if (config.tripMember || config.dayInTrip) {
            const tripId = (params as { id?: unknown } | undefined)?.id;
            if (typeof tripId !== 'string') {
                throw new Error(`[motonui][withRoute] ${config.name}: tripMember/dayInTrip require an "id" param schema`);
            }
            await requireTripMember(supabase, tripId, user.id);
            if (config.dayInTrip) {
                const dayId = (params as { dayId?: unknown }).dayId;
                if (typeof dayId === 'string') {
                    // Unknown day or a day of another trip: indistinguishable to the caller.
                    await requireDayInTrip(supabase, tripId, dayId).catch((error: unknown) => {
                        throw error instanceof AppError ? Errors.notFound('Giorno') : error;
                    });
                }
            }
        }

        const query = (config.query
            ? parseOrThrow(config.query, Object.fromEntries(new URL(request.url).searchParams))
            : undefined) as Parsed<Q>;
        const body = (config.body ? parseOrThrow(config.body, await readJson(request)) : undefined) as Parsed<B>;

        const response = await handler({ request, supabase, user, params, query, body });
        if (!response.headers.has('Cache-Control')) {
            try {
                response.headers.set('Cache-Control', 'private, no-store');
            } catch {
                // Immutable headers (e.g. Response.redirect): leave as is.
            }
        }
        return response;
    }, config.name);

    const typed = wrapped as unknown as (request: Request, context: { params: Promise<RawParams<P>> }) => Promise<Response>;
    // The config travels with the handler: contract tests read its schemas (T-3.8).
    return Object.assign(typed, { route: config });
}
