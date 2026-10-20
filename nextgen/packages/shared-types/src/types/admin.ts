/** motonui domain types — Admin panel, roles and plans. */

// =============================================================================
// ADMIN TYPES
// =============================================================================

export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'premium';
export type PremiumFeatureKey = 'ai_blog' | 'ai_generate_post' | 'ai_destination' | 'instagram_caption' | 'advanced_reminders' | 'packing_checklist';

/** Admin action types recorded in the audit log */
export type AdminAction = 'impersonate' | 'suspend' | 'unsuspend' | 'delete' | 'view_profile';

/** Public profile row in public.profiles */
export interface Profile {
  id: string;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  plan: UserPlan;
  premium_until: string | null;
  premium_enabled_by: string | null;
  premium_enabled_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface FeatureEntitlement {
  id: string;
  user_id: string;
  feature_key: PremiumFeatureKey;
  enabled: boolean;
  daily_limit: number | null;
  monthly_limit: number | null;
  created_at: string;
  updated_at: string;
}

/** Admin audit log entry */
export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: AdminAction;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** User summary used in admin user list */
export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  premiumUntil: string | null;
  suspendedAt: string | null;
  tripsCount: number;
  expensesCount: number;
  postsCount: number;
  createdAt: string;
  lastSignInAt: string | null;
}

/** Aggregate platform statistics */
export interface PlatformStats {
  totalUsers: number;
  activeUsersLast30Days: number;
  totalTrips: number;
  totalExpenses: number;
  totalPosts: number;
  totalAiCalls: number;
}

/** JWT payload for admin impersonation tokens */
export interface ImpersonationPayload {
  adminId: string;
  targetId: string;
  expiresAt: number;
  type: 'impersonation';
}
