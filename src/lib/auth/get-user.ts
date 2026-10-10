import { Errors } from '@/lib/errors';

export interface AuthUser {
    id: string;
    email?: string | null;
}

export interface SupabaseWithAuth {
    auth: {
        getUser: () => Promise<{ data: { user: AuthUser | null } }>;
    };
}

/**
 * Returns the current authenticated user.
 * Throws Errors.unauthorized() if no user is found.
 */
export async function getAuthUser(supabase: SupabaseWithAuth): Promise<AuthUser> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();
    return user;
}

/**
 * Returns the current user, or null without a session.
 * For public pages that render for anonymous visitors too.
 */
export async function getOptionalAuthUser(supabase: SupabaseWithAuth): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}
