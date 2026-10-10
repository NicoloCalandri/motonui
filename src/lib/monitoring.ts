import * as Sentry from '@sentry/nextjs';
import { log } from './log';

/**
 * Error reporting (T-4.2). Sentry is initialised in src/instrumentation.ts
 * and src/instrumentation-client.ts; when it is disabled (no DSN) the calls
 * below are no-ops and only the structured log remains.
 */

/** Logs an unexpected error and reports it to Sentry with safe tags. */
export function captureError(error: unknown, context: { route?: string; requestId?: string } = {}): void {
    log.error(`[motonui][${context.route ?? 'error'}] unexpected error`, error);
    Sentry.withScope((scope) => {
        if (context.route) scope.setTag('route', context.route);
        if (context.requestId) scope.setTag('request_id', context.requestId);
        Sentry.captureException(error);
    });
}

/** Attaches the user id (never the email) to later events. */
export function setUserContext(userId: string): void {
    Sentry.setUser({ id: userId });
}
