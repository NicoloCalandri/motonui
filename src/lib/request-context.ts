import { AsyncLocalStorage } from 'node:async_hooks';
import { setRequestIdProvider } from './log';

/**
 * Request id for the current API request (T-4.3). withErrorHandler runs every
 * handler inside runWithRequestId, so log lines written anywhere below it
 * carry the same id as the `x-request-id` response header. Node runtime only.
 */

const storage = new AsyncLocalStorage<{ requestId: string }>();

setRequestIdProvider(() => storage.getStore()?.requestId);

const SAFE_ID = /^[A-Za-z0-9:._-]{1,128}$/;

/** Reuses the id set by Vercel or a proxy when it is well formed, else a new UUID. */
export function requestIdFrom(request: Request): string {
    for (const header of ['x-request-id', 'x-vercel-id']) {
        const value = request.headers.get(header);
        if (value && SAFE_ID.test(value)) return value;
    }
    return crypto.randomUUID();
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
    return storage.run({ requestId }, fn);
}
