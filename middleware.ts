import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { updateSession } from '@/lib/supabase/middleware';
import type { ImpersonationPayload } from '@/lib/types';

/**
 * Route protection middleware.
 * - Refreshes Supabase auth session on every request
 * - Redirects unauthenticated users from protected routes to /auth/login
 * - Blocks suspended users and redirects to /suspended
 * - Protects /admin routes — admin role required
 * - Handles read-only impersonation sessions
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Routes that do NOT require authentication
    const isPublicRoute =
        pathname === '/' ||
        pathname === '/suspended' ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/blog') ||
        pathname.startsWith('/api/posts') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon');

    const { supabaseResponse: response, user } = await updateSession(request);

    // ── Impersonation token handling ───────────────────────────────────────
    const impersonationToken = request.cookies.get('impersonation_token')?.value;

    if (impersonationToken) {
        try {
            const secret = new TextEncoder().encode(
                process.env.ADMIN_IMPERSONATION_SECRET!
            );
            const { payload } = await jwtVerify(impersonationToken, secret);
            const imp = payload as unknown as ImpersonationPayload;

            // Block write methods in impersonation mode
            const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
            const isExitRoute = pathname === '/api/admin/impersonate/exit';

            if (isWriteMethod && !isExitRoute) {
                return NextResponse.json(
                    {
                        error: 'Operazione non disponibile in modalità anteprima 🏝️',
                        code: 'IMPERSONATION_READ_ONLY',
                        status: 403,
                    },
                    { status: 403 }
                );
            }

            // Forward impersonated identity to Server Components via headers
            response.headers.set('x-impersonated-user-id', imp.targetId);
            response.headers.set('x-impersonating-admin-id', imp.adminId);
        } catch {
            // Token expired or invalid — silently remove
            response.cookies.delete('impersonation_token');
        }
    }

    // ── Redirect unauthenticated users ─────────────────────────────────────
    if (!isPublicRoute && !user) {
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (user) {
        // Fetch profile for role/suspension check
        // We check role/suspension via the Supabase REST API to avoid circular imports.
        // A lightweight inline check is done below using the anon key.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        const profileRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role,suspended_at`,
            {
                headers: {
                    apikey: anonKey,
                    Authorization: `Bearer ${anonKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (profileRes.ok) {
            const profiles = await profileRes.json() as Array<{ role: string; suspended_at: string | null }>;
            const profile = profiles[0];

            if (profile) {
                // Block suspended users everywhere except /suspended and /auth
                if (profile.suspended_at && !pathname.startsWith('/suspended') && !pathname.startsWith('/auth')) {
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
