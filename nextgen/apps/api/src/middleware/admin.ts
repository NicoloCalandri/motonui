import { createMiddleware } from 'hono/factory';
import { isAdminAuthBypassEnabled } from '../lib/auth/admin-bypass';
import type { AppEnv } from '../types';

const DEV_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Requires the caller's profile.role === 'admin'. Replaces the
 * pathname.startsWith('/admin') check in the old middleware.ts plus the
 * requireAdmin() re-check that (admin)/admin/layout.tsx did server-side.
 * Keeps the ADMIN_AUTH_BYPASS development escape hatch of
 * src/lib/auth/require-admin.ts, which is ignored in production
 * (lib/auth/admin-bypass.ts). Must run after requireUser + loadProfile.
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
    if (isAdminAuthBypassEnabled()) {
        c.set('adminId', DEV_ADMIN_ID);
        await next();
        return;
    }

    const profile = c.get('profile');
    if (profile?.role !== 'admin') {
        return c.json({ error: 'Accesso non autorizzato.', code: 'FORBIDDEN', status: 403 }, 403);
    }

    c.set('adminId', c.get('user').id);
    await next();
});
