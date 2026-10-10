import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Anonymous Supabase client for the public blog (T-5.1): anon key, no session,
 * no cookies. It sees exactly what any visitor sees through RLS
 * (`posts_select_published`), whoever is signed in, and does not make the
 * page depend on the request's cookies.
 */
export function createPublicClient(): SupabaseClient<Database> {
    return createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
}
