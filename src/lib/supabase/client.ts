import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { browserSessionCookieOptions } from './cookie-options';

/**
 * Creates a Supabase browser client for use in Client Components.
 * Uses the @supabase/ssr package for proper cookie-based auth handling.
 */
export function createClient() {
    const client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookieOptions: browserSessionCookieOptions() }
    );

    return client;
}
