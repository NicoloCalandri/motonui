import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { AppError, Errors, type ApiErrorResponse } from '../lib/errors';
import { log } from '../lib/log';
import { requestIdFrom, runWithRequestId } from '../lib/request-context';
import type { AppEnv } from '../types';

/**
 * Gives every request an id (reused from the proxy when well formed), runs
 * the rest of the chain inside it so log lines carry it, and echoes it in
 * `x-request-id`. Replaces the request-id half of withErrorHandler in the
 * Next.js app (src/lib/errors.ts).
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
    const requestId = requestIdFrom(c.req.raw);
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    await runWithRequestId(requestId, next);
});

function json(c: Context, error: AppError): Response {
    const body: ApiErrorResponse = { error: error.message, code: error.code, status: error.status };
    return new Response(JSON.stringify(body), {
        status: error.status,
        headers: { 'content-type': 'application/json; charset=UTF-8', ...error.headers },
    });
}

/**
 * Turns a thrown value into the standard error response. Expected errors
 * (AppError) keep their message; anything else is logged in full (redacted)
 * and answered with the generic message.
 */
export function errorResponse(c: Context, error: unknown, routeInfo: string): Response {
    if (error instanceof AppError) {
        log.warn(`[motonui][${routeInfo}] ${error.code}`, { status: error.status, message: error.message });
        return json(c, error);
    }
    log.error(`[motonui][${routeInfo}] unexpected error`, error);
    return json(c, Errors.internal());
}

/** app.onError: errors thrown outside withErrorHandler (middleware, unwrapped handlers). */
export function handleAppError(error: Error, c: Context): Response {
    // onError runs outside the middleware chain: restore the request id for the log line.
    const requestId = (c.get('requestId') as string | undefined) ?? requestIdFrom(c.req.raw);
    const response = runWithRequestId(requestId, () => errorResponse(c, error, `${c.req.method} ${c.req.path}`));
    response.headers.set('x-request-id', requestId);
    return response;
}

/** app.notFound: the standard error shape instead of Hono's plain text. */
export function handleNotFound(c: Context): Response {
    return json(c, new AppError('Questa pagina non esiste 🏝️', 'NOT_FOUND', 404));
}
