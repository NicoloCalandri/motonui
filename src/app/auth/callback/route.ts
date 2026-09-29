import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { safeRedirectPath } from '@/lib/redirect';

/**
 * OAuth callback route — Supabase redirects here after Google sign-in.
 * Exchanges the code for a session, then redirects to the original page.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const redirectTo = safeRedirectPath(requestUrl.searchParams.get('redirect'));

    if (code) {
        const supabase = await createClient();
        await supabase.auth.exchangeCodeForSession(code);
    }

    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
