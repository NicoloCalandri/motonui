import { createMiddleware } from 'hono/factory';
import { env } from '../lib/env';
import type { AppEnv } from '../types';

const DEV_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Requires the caller's profile.role === 'admin'. Replaces the
 * pathname.startsWith('/admin') check in the old middleware.ts plus the
 * requireAdmin() re-check that (admin)/admin/layout.tsx did server-side.
 * Preserves the ADMIN_AUTH_BYPASS dev-only escape hatch from
 * src/lib/auth/require-admin.ts. Must run after requireUser + loadProfile.
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
    if (env.ADMIN_AUTH_BYPASS) {
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
