import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Creates a Supabase server client for use in Server Components, Route Handlers, and Server Actions.
 * Reads and writes cookies to maintain auth session across requests.
 */
export async function createClient() {
    const cookieStore = await cookies();

    // ─── Development Ultimate Bypass ───
    // If in development, we use the service role key (to bypass RLS) 
    // AND we mock the auth object so getUser() always returns a valid user.
    if (process.env.NODE_ENV === 'development') {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
        const adminSupabase = createSupabaseClient<any>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypass RLS
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Mock the auth object
        const mockUser = {
            id: '00000000-0000-0000-0000-000000000001', // Matches seed.sql
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        };

        // Inject proxy to simulate authenticated state
        const proxy = new Proxy(adminSupabase, {
            get(target, prop) {
                if (prop === 'auth') {
                    return {
                        getUser: async () => ({ data: { user: mockUser }, error: null }),
                        getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
                        signInWithPassword: async () => ({ data: { user: mockUser }, error: null }),
                        signOut: async () => ({ error: null }),
                    };
                }
                return (target as any)[prop];
            }
        });

        return proxy;
    }

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
