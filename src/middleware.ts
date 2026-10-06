import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isImpersonationTokenActive, verifyImpersonationToken } from '@/lib/admin/impersonation-token';
import { buildCsp, createNonce } from '@/lib/csp';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Cron endpoints: called server-to-server without a user session, they check
 * `Authorization: Bearer ${CRON_SECRET}` (src/lib/auth/cron.ts).
 */
const CRON_ROUTES = new Set(['/api/admin/send-reminders', '/api/admin/cleanup']);

function apiError(error: string, code: string, status: number) {
    return NextResponse.json({ error, code, status }, { status });
}

/**
 * True if a state-changing request comes from another site (T-1.9, SR-WEB-04).
 * Browsers always send Origin on cross-origin POST/PUT/PATCH/DELETE and
 * Sec-Fetch-Site on modern versions; requests with neither (curl, server to
 * server) carry no ambient cookies from a victim and are left to auth.
 */
function isCrossSiteWrite(request: NextRequest): boolean {
    const trusted = new Set([request.nextUrl.origin]);
    if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
            trusted.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
        } catch {
            // Invalid NEXT_PUBLIC_APP_URL: only the request's own origin is trusted.
        }
    }

    const origin = request.headers.get('origin');
    if (origin) return !trusted.has(origin);

    const fetchSite = request.headers.get('sec-fetch-site');
    return fetchSite === 'cross-site' || fetchSite === 'same-site';
}

/**
 * Every response gets a Content-Security-Policy with a per-request nonce
 * (T-4.4). The nonce also travels on the request (`x-nonce`, and the CSP
 * header Next.js reads to tag its own scripts); static security headers live
 * in next.config.ts.
 */
export async function middleware(request: NextRequest) {
    const nonce = createNonce();
    const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === 'development' });
    request.headers.set('x-nonce', nonce);
    request.headers.set('content-security-policy', csp);

    const response = await protect(request);
    response.headers.set('content-security-policy', csp);
    return response;
}

/**
 * Route protection.
 * - Rejects cross-site writes to the API
 * - Refreshes the Supabase session on every request
 * - Unauthenticated: 401 JSON for /api/*, redirect to /auth/login for pages
 * - Blocks suspended users and redirects to /suspended
 * - Protects /admin routes — admin role required
 * - Read-only impersonation, with revocation checked against the database
 */
async function protect(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isApi = pathname.startsWith('/api/');
    const isWrite = WRITE_METHODS.has(request.method);
    const isCronRoute = CRON_ROUTES.has(pathname);

    if (isApi && isWrite && !isCronRoute && isCrossSiteWrite(request)) {
        return apiError('Richiesta non consentita da un sito esterno.', 'CROSS_SITE_REQUEST', 403);
    }

    // Routes that do NOT require authentication
    const isPublicRoute =
        pathname === '/' ||
        pathname === '/suspended' ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/blog') ||
        pathname.startsWith('/api/posts') ||
        isCronRoute ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon');

    const { supabaseResponse: response, user, profile } = await updateSession(request);

    // ── Impersonation (ADR-07: read-only banner session, revocable) ────────
    const impersonationToken = request.cookies.get('impersonation_token')?.value;

    if (impersonationToken) {
        const claims = await verifyImpersonationToken(impersonationToken, process.env.ADMIN_IMPERSONATION_SECRET);
        const active = claims !== null && (await isImpersonationTokenActive(claims.jti));

        if (!active) {
            // Expired, forged or revoked on exit: drop the impersonation cookies.
            response.cookies.delete('impersonation_token');
            response.cookies.delete('impersonation_display_name');
        } else if (isWrite && pathname !== '/api/admin/impersonate/exit') {
            return apiError('Operazione non disponibile in modalità anteprima 🏝️', 'IMPERSONATION_READ_ONLY', 403);
        }
    }

    // ── Unauthenticated ────────────────────────────────────────────────────
    if (!isPublicRoute && !user) {
        if (isApi) {
            return apiError('Non sei autenticato. Effettua il login per continuare.', 'UNAUTHORIZED', 401);
        }
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (user) {
        if (profile) {
            // Block suspended users everywhere except /suspended and /auth
            if (profile.suspended_at && !pathname.startsWith('/suspended') && !pathname.startsWith('/auth')) {
                if (isApi) {
                    return apiError('Il tuo account è sospeso.', 'ACCOUNT_SUSPENDED', 403);
                }
                return NextResponse.redirect(new URL('/suspended', request.url));
            }

            // Protect /admin routes — admin only
            if (pathname.startsWith('/admin') && profile.role !== 'admin') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // Store role in a non-httpOnly cookie for client-side UI hints (not sensitive)
            response.cookies.set('user_role', profile.role ?? 'user', {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
        }

        // Redirect authenticated users away from auth pages
        if (pathname.startsWith('/auth')) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except static assets and Next.js internals.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
