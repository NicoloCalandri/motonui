import { supabase } from '../supabase-client';

/**
 * Stands in for src/lib/supabase/client.ts in files copied from the Next.js
 * app: there `createClient()` builds a cookie-based browser client, here it
 * hands back the one client of the SPA (bearer session in local storage).
 */
export function createClient() {
    return supabase;
}
