import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Route protection middleware.
 * - Refreshes Supabase auth session on every request
 * - Redirects unauthenticated users from protected routes to /auth/login
 * - Allows unauthenticated access to public routes (blog, auth pages)
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Routes that do NOT require authentication
    const isPublicRoute =
        pathname === '/' ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/blog') ||
        pathname.startsWith('/api/posts') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon');

    const { supabaseResponse, user } = await updateSession(request);

    // Redirect to login if accessing protected route without a session
    if (!isPublicRoute && !user) {
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect already-authenticated users away from auth pages
    if (user && pathname.startsWith('/auth')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except static assets and Next.js internals.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
