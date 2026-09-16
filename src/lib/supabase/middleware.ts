import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

export interface MiddlewareProfile {
    role: string;
    suspended_at: string | null;
}

/**
 * Updates the Supabase session in middleware.
 * Must be called in middleware.ts to keep auth tokens fresh.
 * Returns (request, response) with refreshed session cookies applied, plus the
 * caller's own profile (role/suspension), fetched with the *authenticated*
 * client so RLS (`auth.uid() = id`) actually scopes the row to the caller.
 */
export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: any[]) {
                    cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }: any) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session — IMPORTANT: do not remove this call.
    let {
        data: { user },
    } = await supabase.auth.getUser();

    let profile: MiddlewareProfile | null = null;
    if (user) {
        const { data, error } = await supabase
            .from('profiles')
            .select('role, suspended_at')
            .eq('id', user.id)
            .single();
        if (error) {
            console.error('[motonui][middleware] profile lookup failed:', error.message);
        }
        profile = data ?? null;
    }

    return { supabaseResponse, user, profile };
}
