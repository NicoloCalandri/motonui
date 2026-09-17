import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@motonui/shared-types';
import { env } from '../env';

/**
 * Per-request Supabase client scoped to the caller's JWT (sent as a Bearer
 * token by the SPA). RLS applies exactly as it did with the cookie-bound
 * server client in the old Next.js app — only the transport changed.
 */
export function createUserClient(accessToken: string) {
    return createSupabaseClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

/**
 * Admin client using the service role key. ONLY use server-side, never
 * expose the service role key to any client.
 */
export function createAdminClient() {
    return createSupabaseClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
