import type { Context } from 'hono';
import { errorResponse } from '../middleware/request-context';
import { Errors } from './errors';
import type { AppEnv } from '../types';

// Typed with the app environment, so c.get('supabase') is the typed client and queries are checked.
type Handler = (c: Context<AppEnv>) => Promise<Response>;

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

/**
 * Reads a JSON request body that must be an object. Malformed JSON and any
 * other JSON value (array, string, number, null) are a validation error, so
 * a handler's Zod schema always starts from an object and a bad body is a
 * 400, never a 500.
 */
export async function readJsonObject(c: Context): Promise<Record<string, unknown>> {
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        throw Errors.validation('il corpo della richiesta non è JSON valido');
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw Errors.validation('il corpo della richiesta deve essere un oggetto');
    }
    return body as Record<string, unknown>;
}

/**
 * Reads a multipart body. A request with another content type (or a broken
 * multipart payload) is a validation error instead of an unhandled exception.
 */
export async function readFormData(c: Context): Promise<FormData> {
    try {
        return await c.req.formData();
    } catch {
        throw Errors.validation('il corpo della richiesta deve essere multipart/form-data');
    }
}

/** Short, client-safe description of a Zod failure: the fields, not the whole issue dump. */
export function issueSummary(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): string {
    return error.issues
        .slice(0, 5)
        .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ');
}

const ID_PARAM = /^(id|[A-Za-z]+Id)$/;
// Same shape Postgres accepts for a uuid column: version and variant bits are
// not checked, because seed and test rows use ids such as 00000000-…-0001.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
