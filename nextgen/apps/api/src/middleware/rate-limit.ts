import { createMiddleware } from 'hono/factory';
import { enforceRateLimit, ipSubject, userSubject, type RateLimitBucket } from '../lib/rate-limit';
import type { AppEnv } from '../types';

/**
 * Counts the request in `bucket` for the signed-in user and answers 429
 * (with Retry-After) over the limit. Mount after requireUser. Only the given
 * methods are counted, so reads on the same path stay free.
 */
export function rateLimit(bucket: RateLimitBucket, methods: readonly string[] = ['POST']) {
    return createMiddleware<AppEnv>(async (c, next) => {
        if (methods.includes(c.req.method)) {
            await enforceRateLimit(bucket, userSubject(c.get('user').id));
        }
        await next();
    });
}

/** Same, for public routes: keyed by a hash of the client IP, never the address itself. */
export function rateLimitByIp(bucket: RateLimitBucket, methods: readonly string[] = ['GET']) {
    return createMiddleware<AppEnv>(async (c, next) => {
        if (methods.includes(c.req.method)) {
            await enforceRateLimit(bucket, ipSubject(c.req.raw));
        }
        await next();
    });
}
