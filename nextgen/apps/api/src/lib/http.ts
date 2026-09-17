import type { Context } from 'hono';
import { AppError, Errors, type ApiErrorResponse } from './errors';

type Handler = (c: Context) => Promise<Response>;

/**
 * Wraps a route handler with try/catch error handling.
 * Logs errors with structured format and returns consistent JSON error responses.
 * Direct port of the Next.js withErrorHandler in src/lib/errors.ts — only the
 * (request, context) -> Response signature became (c: Context) -> Response.
 */
export function withErrorHandler(handler: Handler, routeInfo: string): Handler {
    return async (c) => {
        try {
            return await handler(c);
        } catch (error) {
            if (error instanceof AppError) {
                console.error(`[motonui][${routeInfo}] AppError:`, {
                    code: error.code,
                    status: error.status,
                    message: error.message,
                });
                return c.json(
                    { error: error.message, code: error.code, status: error.status } satisfies ApiErrorResponse,
                    error.status as any
                );
            }

            console.error(`[motonui][${routeInfo}] Unexpected error:`, error);
            const internal = Errors.internal();
            return c.json(
                { error: internal.message, code: internal.code, status: internal.status } satisfies ApiErrorResponse,
                500
            );
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
    return value;
}
