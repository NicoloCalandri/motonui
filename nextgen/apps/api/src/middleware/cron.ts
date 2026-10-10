import { createMiddleware } from 'hono/factory';
import { isAuthorizedCronRequest } from '../lib/auth/cron';
import { Errors } from '../lib/errors';
import type { AppEnv } from '../types';

/**
 * Lets a request through only with `Authorization: Bearer ${CRON_SECRET}`
 * (constant-time comparison, fails closed without a 32-character secret).
 * Same contract as the Next.js cron routes, so one scheduler configuration
 * works for both.
 */
export const requireCronSecret = createMiddleware<AppEnv>(async (c, next) => {
    if (!isAuthorizedCronRequest(c.req.raw)) throw Errors.unauthorized();
    await next();
});
