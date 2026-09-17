import { Hono } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import { createAdminClient } from '../../lib/supabase/server';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import type { AppEnv } from '../../types';

export const impersonateExitRouter = new Hono<AppEnv>();

/**
 * POST /api/admin/impersonate/exit — end an impersonation session.
 * Mount path must stay exactly '/api/admin/impersonate/exit' — the
 * handleImpersonation middleware exempts this exact path from the
 * write-method block while impersonating.
 */
impersonateExitRouter.post('/exit', requireUser, loadProfile, requireAdmin, async (c) => {
    const token = getCookie(c, 'impersonation_token');

    if (token) {
        const supabase = createAdminClient();
        await (supabase as any).from('impersonation_tokens').delete().eq('token', token);
    }

    deleteCookie(c, 'impersonation_token', { path: '/' });
    deleteCookie(c, 'impersonation_display_name', { path: '/' });

    return c.json({ exited: true });
});
