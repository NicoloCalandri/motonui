import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Creates a Supabase server client for use in Server Components, Route Handlers, and Server Actions.
 * Reads and writes cookies to maintain auth session across requests.
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: any[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }: any) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll called from a Server Component — cookies can't be set there.
                    }
                },
            },
        }
    );
}

/**
 * Creates a Supabase admin client using the service role key.
 * ONLY use server-side. Never expose service role key to the client.
 */
export async function createAdminClient() {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    return createSupabaseClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
