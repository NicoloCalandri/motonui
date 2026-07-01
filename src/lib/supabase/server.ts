import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import type {
    PremiumFeatureKey,
    ReminderEntityType,
    ReminderType,
    UserPlan,
    UserRole,
} from '@/lib/types';

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
    Row: Row;
    Insert: Insert;
    Update: Update;
    Relationships: [];
};

type ProfileRow = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    role: UserRole;
    plan: UserPlan;
    premium_until: string | null;
    premium_enabled_at: string | null;
    premium_enabled_by: string | null;
    suspended_at: string | null;
    suspended_reason: string | null;
    created_at: string;
    updated_at: string;
};

type ReminderRow = {
    id: string;
    trip_id: string;
    user_id: string;
    entity_type: ReminderEntityType;
    entity_id: string;
    type: ReminderType;
    remind_at: string;
    sent_at: string | null;
    title: string;
    message: string | null;
    created_at: string;
};

type FeatureControlRow = {
    id: string;
    feature_key: PremiumFeatureKey;
    enabled: boolean;
    hard_daily_cap: number | null;
    daily_usage: number | null;
    usage_date: string | null;
    alert_thresholds: number[] | null;
    alerted_thresholds: number[] | null;
    updated_at: string;
    updated_by: string | null;
};

type FeatureEntitlementRow = {
    id: string;
    user_id: string;
    feature_key: PremiumFeatureKey;
    enabled: boolean;
    daily_limit: number | null;
    monthly_limit: number | null;
    created_at: string;
    updated_at: string;
};

type UsageCounterRow = {
    id: string;
    user_id: string;
    feature_key: PremiumFeatureKey;
    period_type: 'day' | 'month';
    period_start: string;
    usage_count: number;
    updated_at: string;
};

type ImpersonationTokenRow = {
    id: string;
    admin_id: string;
    target_id: string;
    token: string;
    expires_at: string;
    created_at: string;
};

type AdminAuditLogRow = {
    id: string;
    admin_id: string;
    admin_email: string | null;
    action: string;
    target_id: string | null;
    target_user_id: string | null;
    target_email: string | null;
    details: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

type AdminUserViewRow = {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    role: UserRole;
    plan: UserPlan | null;
    premium_until: string | null;
    premium_enabled_at: string | null;
    premium_enabled_by: string | null;
    suspended_at: string | null;
    suspended_reason: string | null;
    created_at: string;
    last_sign_in_at: string | null;
};

export type AppDatabase = Omit<Database, 'public'> & {
    public: Omit<Database['public'], 'Tables' | 'Views'> & {
        Tables: Database['public']['Tables'] & {
            profiles: TableDefinition<ProfileRow>;
            reminders: TableDefinition<ReminderRow>;
            feature_controls: TableDefinition<FeatureControlRow>;
            feature_entitlements: TableDefinition<FeatureEntitlementRow>;
            usage_counters: TableDefinition<UsageCounterRow>;
            impersonation_tokens: TableDefinition<ImpersonationTokenRow>;
            admin_audit_log: TableDefinition<AdminAuditLogRow>;
        };
        Views: Database['public']['Views'] & {
            admin_user_view: {
                Row: AdminUserViewRow;
                Relationships: [];
            };
        };
    };
};

/**
 * Creates a Supabase server client for use in Server Components, Route Handlers, and Server Actions.
 * In development mode, returns a service-role client to bypass RLS (dev seed user has no JWT session).
 * In production, reads and writes cookies to maintain auth session across requests.
 */
export async function createClient() {
    const cookieStore = await cookies();
    type CookieToSet = {
        name: string;
        value: string;
        options?: Parameters<typeof cookieStore.set>[2];
    };

    return createServerClient<AppDatabase>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: CookieToSet[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
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
    return createSupabaseClient<AppDatabase>(
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
