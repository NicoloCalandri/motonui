import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import { isImpersonationTokenActive, verifyImpersonationToken } from '../lib/admin/impersonation-token';
import { env } from '../lib/env';
import type { AppEnv } from '../types';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Port of the impersonation block of src/middleware.ts. Reads the httpOnly
 * `impersonation_token` cookie, accepts it only if it is a valid HS256
 * impersonation token whose id is still stored (exit revokes it), blocks
 * write methods while impersonating (except the exit route), and forwards
 * the impersonated/admin ids for downstream handlers and audit logging.
 * Mounted on /api/*: a no-op when the cookie is absent.
 */
export const handleImpersonation = createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, 'impersonation_token');
    if (!token) {
        await next();
        return;
    }

    const claims = await verifyImpersonationToken(token, env.ADMIN_IMPERSONATION_SECRET);
    if (!claims || !(await isImpersonationTokenActive(claims.jti))) {
        deleteCookie(c, 'impersonation_token', { path: '/' });
        deleteCookie(c, 'impersonation_display_name', { path: '/' });
        await next();
        return;
    }

    const isWriteMethod = WRITE_METHODS.includes(c.req.method);
    const isExitRoute = c.req.path === '/api/admin/impersonate/exit';

    if (isWriteMethod && !isExitRoute) {
        return c.json(
            {
                error: 'Operazione non disponibile in modalità anteprima 🏝️',
                code: 'IMPERSONATION_READ_ONLY',
                status: 403,
            },
            403
        );
    }

    c.set('impersonatedUserId', claims.targetId);
    c.set('impersonatingAdminId', claims.adminId);
    await next();
});
