import { createMiddleware } from 'hono/factory';
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
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
    const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

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
