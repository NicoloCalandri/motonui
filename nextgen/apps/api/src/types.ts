import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@motonui/shared-types';
import type { AuthUser } from './lib/auth/get-user';

export interface MiddlewareProfile {
    role: string;
    suspended_at: string | null;
}

export interface AppVariables {
    supabase: SupabaseClient<Database>;
    user: AuthUser;
    profile: MiddlewareProfile | null;
    adminId: string;
    impersonatedUserId?: string;
    impersonatingAdminId?: string;
}

export type AppEnv = { Variables: AppVariables };
