import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Options of the Supabase session cookies (audit A3.13, SR-WEB-03), shared by
 * the server client, the proxy and the browser client so every writer sets the
 * same flags.
 *
 * - `Secure` whenever the app runs over HTTPS: @supabase/ssr leaves it off by
 *   default, so without this the session cookie could travel in clear text on
 *   a plain-HTTP request (HSTS covers browsers that already saw the site).
 * - `SameSite=Lax`: sent on top-level navigations (OAuth return, links from
 *   emails), not on cross-site subrequests; the proxy also checks `Origin` on
 *   API writes (SR-WEB-04).
 * - Not `HttpOnly`, by design: the browser client (login, direct uploads,
 *   mobile parity) reads the session from `document.cookie`. XSS is contained
 *   by the nonce-based CSP instead (src/lib/csp.ts).
 */
export function sessionCookieOptions(secure: boolean): CookieOptionsWithName {
    return { path: '/', sameSite: 'lax', secure, httpOnly: false };
}

/** Server side (route handlers, server components, proxy): HTTPS in production. */
export function serverSessionCookieOptions(): CookieOptionsWithName {
    return sessionCookieOptions(process.env.NODE_ENV === 'production');
}

/** Browser side: follows the page protocol, so local HTTP development keeps working. */
export function browserSessionCookieOptions(): CookieOptionsWithName {
    const https = typeof window !== 'undefined' && window.location.protocol === 'https:';
    return sessionCookieOptions(https);
}
