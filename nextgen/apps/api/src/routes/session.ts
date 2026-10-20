import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { decodeJwt } from 'jose';
import { withErrorHandler, ok } from '../lib/http';
import { requireUser, SESSION_COOKIE } from '../middleware/auth';
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

const MAX_COOKIE_SECONDS = 60 * 60;

/** Seconds the token still has to live, capped: the cookie must not outlive it. */
function secondsLeft(token: string): number {
    try {
        const { exp } = decodeJwt(token);
        if (typeof exp === 'number') return Math.max(1, Math.min(MAX_COOKIE_SECONDS, exp - Math.floor(Date.now() / 1000)));
    } catch {
        // Not a JWT we can read: the token was accepted by Supabase, keep the default.
    }
    return MAX_COOKIE_SECONDS;
}

/**
 * POST /api/session/cookie — copies the caller's access token into an
 * httpOnly cookie, so that the browser can read private files (documents,
 * boarding passes) with a plain `<img src>` or link, as the components copied
 * from the Next.js app do. The web app calls it whenever its token changes.
 *
 * requireUser accepts the cookie on reads only, and this route is a write: it
 * can be called with the bearer token and nothing else. SameSite=Strict and
 * Path=/api keep the cookie off cross-site requests and off everything that
 * is not the API.
 */
sessionRouter.post(
    '/cookie',
    requireUser,
    withErrorHandler(async (c) => {
        const token = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
        setCookie(c, SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/api',
            maxAge: secondsLeft(token),
        });
        return ok(c, { set: true });
    }, 'session/cookie POST')
);

/** DELETE /api/session/cookie — clears it, on sign-out. Needs no session: there may be none left. */
sessionRouter.delete('/cookie', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/api', secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', httpOnly: true });
    return c.json({ cleared: true });
});
