import { Hono } from 'hono';
import { withErrorHandler, ok } from '../lib/http';
import { requireUser } from '../middleware/auth';
import type { AppEnv } from '../types';

// Mounted at /api/session. Not in the Next.js API: there the middleware and
// the server layouts read the profile before a page renders. The SPA asks
// here, once per session, and its route guards decide from the answer.
export const sessionRouter = new Hono<AppEnv>();

/**
 * GET /api/session — identity, role and suspension of the caller.
 *
 * No loadProfile: it refuses suspended users, and a suspended user is exactly
 * who needs this answer (the page that says why). Read with the caller's own
 * client, so RLS limits the row to them. The guards of the web app are for
 * navigation only: every API route still checks role and suspension itself.
 */
sessionRouter.get(
    '/',
    requireUser,
    withErrorHandler(async (c) => {
        const user = c.get('user');

        const { data: profile, error } = await c.get('supabase')
            .from('profiles')
            .select('display_name, avatar_url, role, suspended_at, suspended_reason')
            .eq('id', user.id)
            .maybeSingle();

        if (error) throw new Error(`[motonui][session][GET] ${error.message}`);

        return ok(c, {
            id: user.id,
            email: user.email ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            role: profile?.role ?? 'user',
            suspended_at: profile?.suspended_at ?? null,
            suspended_reason: profile?.suspended_reason ?? null,
        });
    }, 'session GET')
);
