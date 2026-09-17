import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import { jwtVerify } from 'jose';
import type { ImpersonationPayload } from '@motonui/shared-types';
import { env } from '../lib/env';
import type { AppEnv } from '../types';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Direct port of the impersonation-token block in the old root middleware.ts.
 * Reads the httpOnly `impersonation_token` cookie (same-origin deploy keeps
 * this working with zero cross-site-cookie complexity, see plan §Hosting),
 * blocks write methods while impersonating (except the exit route), and
 * forwards the impersonated/admin ids for downstream handlers/audit logging.
 * Mount globally on /api/* — it's a no-op when the cookie is absent.
 */
export const handleImpersonation = createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, 'impersonation_token');
    if (!token) {
        await next();
        return;
    }

    try {
        const secret = new TextEncoder().encode(env.ADMIN_IMPERSONATION_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const imp = payload as unknown as ImpersonationPayload;

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

        c.set('impersonatedUserId', imp.targetId);
        c.set('impersonatingAdminId', imp.adminId);
    } catch {
        deleteCookie(c, 'impersonation_token');
        deleteCookie(c, 'impersonation_display_name');
    }

    await next();
});
