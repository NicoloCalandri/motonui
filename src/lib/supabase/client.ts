import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Creates a Supabase browser client for use in Client Components.
 * Uses the @supabase/ssr package for proper cookie-based auth handling.
 */
export function createClient() {
    const client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // ─── Development Ultimate Bypass ───
    if (process.env.NODE_ENV === 'development') {
        const mockUser = {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'test@example.com',
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        };

        return new Proxy(client, {
            get(target, prop) {
                if (prop === 'auth') {
                    return {
                        getUser: async () => ({ data: { user: mockUser }, error: null }),
                        getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
                        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                        signInWithPassword: async () => ({ data: { user: mockUser }, error: null }),
                        signOut: async () => ({ error: null }),
                    };
                }
                return (target as any)[prop];
            }
        });
    }

    return client;
}
