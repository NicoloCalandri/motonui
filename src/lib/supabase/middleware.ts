import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

/**
 * Updates the Supabase session in middleware.
 * Must be called in middleware.ts to keep auth tokens fresh.
 * Returns (request, response) with refreshed session cookies applied.
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

    return { supabaseResponse, user };
}
