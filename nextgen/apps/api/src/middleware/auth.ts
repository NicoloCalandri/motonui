import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { createUserClient } from '../lib/supabase/server';
import type { AppEnv } from '../types';

/**
 * Replaces the cookie-based session refresh in the old middleware.ts.
 * Reads the Supabase access token from the Authorization header (the SPA
 * attaches it via apps/web/src/lib/api-client.ts) and validates it against
 * Supabase's auth server. Sets `supabase` and `user` on the context for
 * downstream handlers — this is the authoritative auth boundary; there is no
 * server-rendered redirect anymore, only 401 JSON.
 */
export const SESSION_COOKIE = 'motonui_session';

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
    // Already authenticated earlier in the chain (tripGuard): one token check per request.
    if (c.get('user')) {
        await next();
        return;
    }

    const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
    // The session cookie (routes/session.ts) stands in for the header on reads
    // only: an `<img>` or a link cannot send a header, and a forged cross-site
    // request can do no harm with a GET. Writes always need the bearer token.
    const isRead = c.req.method === 'GET' || c.req.method === 'HEAD';
    const token = authHeader?.replace(/^Bearer\s+/i, '') || (isRead ? getCookie(c, SESSION_COOKIE) : undefined);

    if (!token) {
        return c.json({ error: 'Non sei autenticato. Effettua il login per continuare.', code: 'UNAUTHORIZED', status: 401 }, 401);
    }

    const supabase = createUserClient(token);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return c.json({ error: 'Non sei autenticato. Effettua il login per continuare.', code: 'UNAUTHORIZED', status: 401 }, 401);
    }

    c.set('supabase', supabase);
    c.set('user', user);
    await next();
});
