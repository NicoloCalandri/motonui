import { Errors } from '@/lib/errors';
import { getAuthUser } from '@/lib/auth/get-user';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

interface AuthUser {
    id: string;
    email?: string | null;
}

interface SupabaseWithAuth {
    auth: {
        getUser: () => Promise<{ data: { user: AuthUser | null } }>;
    };
}

/**
 * Returns the current authenticated user.
 * In development mode, returns the seed user without hitting Supabase auth.
 * Throws Errors.unauthorized() if no user is found in production.
 */
export async function getAuthUser(supabase: SupabaseWithAuth): Promise<AuthUser> {
    if (process.env.NODE_ENV === 'development') {
        return { id: DEV_USER_ID, email: 'test@example.com' };
    }
    const user = await getAuthUser(supabase);
    if (!user) throw Errors.unauthorized();
    return user;
}
