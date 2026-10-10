import type { Context } from 'hono';
import { errorResponse } from '../middleware/request-context';
import { Errors } from './errors';

type Handler = (c: Context) => Promise<Response>;

/**
 * Wraps a route handler with try/catch error handling.
 * Logs through lib/log (one JSON line with the request id, redacted) and
 * returns the standard JSON error response.
 * Direct port of the Next.js withErrorHandler in src/lib/errors.ts — only the
 * (request, context) -> Response signature became (c: Context) -> Response.
 */
export function withErrorHandler(handler: Handler, routeInfo: string): Handler {
    return async (c) => {
        try {
            return await handler(c);
        } catch (error) {
            return errorResponse(c, error, routeInfo);
        }
    };
}

export function ok<T>(c: Context, data: T, status: number = 200): Response {
    return c.json(data as any, status as any);
}

export function created<T>(c: Context, data: T): Response {
    return c.json(data as any, 201);
}

/**
 * Hono can't statically narrow c.req.param() to `string` for handlers
 * declared outside a chained route-builder type, so route params come back
 * as `string | undefined`. Every route mounts its param in the path (e.g.
 * '/:id'), so it's always present at runtime — this just satisfies the
 * type checker without scattering `!` assertions across every route.
 */
export function requireParam(c: Context, name: string): string {
    const value = c.req.param(name);
    if (value === undefined) throw new Error(`[motonui][http] missing route param '${name}'`);
    // Every id in a path is a row id: anything else is refused here, once,
    // before it reaches a query (params schema of withRoute in the Next.js app).
    if (ID_PARAM.test(name) && !UUID.test(value)) throw Errors.validation('identificativo non valido');
    return value;
}

const ID_PARAM = /^(id|[A-Za-z]+Id)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
