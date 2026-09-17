import { createMiddleware } from 'hono/factory';
import type { AppEnv, MiddlewareProfile } from '../types';

/**
 * Loads the caller's profile (role/suspended_at) with the *user-scoped*
 * client so RLS (auth.uid() = id) actually restricts the row to the caller —
 * same guarantee as the old updateSession() in src/lib/supabase/middleware.ts.
 * Blocks suspended users with 403 (was a redirect to /suspended before;
 * the frontend RequireAuth guard now does that redirect for UX).
 * Must run after requireUser.
 */
export const loadProfile = createMiddleware<AppEnv>(async (c, next) => {
    const supabase = c.get('supabase');
    const user = c.get('user');

    // NOTE: `profiles` is missing from the generated database.types.ts (a
    // pre-existing gap in the old Next.js codebase too, which cast `as any`
    // on every profiles query for the same reason). Regenerate types via
    // `supabase gen types` once the schema drift is fixed upstream.
    const { data, error } = await (supabase as any).from('profiles')
        .select('role, suspended_at')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('[motonui][api][loadProfile] profile lookup failed:', error.message);
    }

    const profile: MiddlewareProfile | null = data ?? null;
    c.set('profile', profile);

    if (profile?.suspended_at) {
        return c.json({ error: 'Account sospeso.', code: 'SUSPENDED', status: 403 }, 403);
    }

    await next();
});
