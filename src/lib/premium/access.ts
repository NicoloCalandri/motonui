import { AppError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { log } from '@/lib/log';

export const FEATURE_KEYS = [
    'ai_blog',
    'ai_generate_post',
    'ai_destination',
    'instagram_caption',
    'advanced_reminders',
    'packing_checklist',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Features that call the Anthropic API: they also count towards AI_DAILY_LIMIT. */
export const AI_FEATURES: ReadonlySet<FeatureKey> = new Set([
    'ai_blog',
    'ai_generate_post',
    'ai_destination',
    'instagram_caption',
    'packing_checklist',
]);

/** Project policy (CLAUDE.md): at most 20 AI calls per user per day, across all AI features. */
export const AI_DAILY_LIMIT = 20;
const AI_TOTAL_COUNTER = 'ai_total';

const DEFAULT_LIMITS: Record<FeatureKey, { daily: number; monthly: number }> = {
    ai_blog: { daily: 20, monthly: 300 },
    ai_generate_post: { daily: 10, monthly: 100 },
    ai_destination: { daily: 20, monthly: 200 },
    instagram_caption: { daily: 20, monthly: 200 },
    advanced_reminders: { daily: 100, monthly: 2000 },
    packing_checklist: { daily: 20, monthly: 200 },
};

interface QuotaCounter {
    feature_key: string;
    period_type: 'day' | 'month';
    period_start: string;
    limit: number;
}

const QUOTA_ERRORS: Record<string, { code: string; message: string }> = {
    day: { code: 'DAILY_QUOTA_EXCEEDED', message: 'Hai raggiunto il limite giornaliero per questa funzionalità premium.' },
    month: { code: 'MONTHLY_QUOTA_EXCEEDED', message: 'Hai raggiunto il limite mensile per questa funzionalità premium.' },
    [`${AI_TOTAL_COUNTER}:day`]: { code: 'AI_DAILY_LIMIT_REACHED', message: `Hai raggiunto il limite di ${AI_DAILY_LIMIT} richieste AI per oggi. Riprova domani 🏝️` },
};

interface RequireFeatureAccessInput {
    userId: string;
    feature: FeatureKey;
    incrementBy?: number;
    allowAdminBypass?: boolean;
    /** Service-role client; injected in tests (T-3.4). */
    supabase?: SupabaseClient;
    /** Clock; injected in tests (T-3.4). */
    now?: Date;
}

interface ProfileRow {
    role: 'user' | 'admin';
    plan: 'free' | 'premium';
    premium_until: string | null;
}

export async function requireFeatureAccess(input: RequireFeatureAccessInput): Promise<void> {
    const {
        userId,
        feature,
        incrementBy = 1,
        allowAdminBypass = false,
    } = input;

    const supabase: SupabaseClient = input.supabase ?? (await createAdminClient());
    const now = input.now ?? new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('role, plan, premium_until')
        .eq('id', userId)
        .single();

    if (profileError || !profile) {
        throw new AppError('Profilo utente non trovato.', 'PROFILE_NOT_FOUND', 404);
    }

    const typedProfile = profile as ProfileRow;
    const isAdmin = typedProfile.role === 'admin';
    const isPremiumActive = typedProfile.plan === 'premium' && (
        !typedProfile.premium_until || new Date(typedProfile.premium_until).getTime() >= now.getTime()
    );
    const canBypass = isAdmin && allowAdminBypass;

    const { data: control } = await supabase.from('feature_controls')
        .select('enabled, hard_daily_cap, daily_usage, usage_date, alert_thresholds, alerted_thresholds')
        .eq('feature_key', feature)
        .single();

    const controlRow = control ?? {
        enabled: true,
        hard_daily_cap: null,
        daily_usage: 0,
        usage_date: today,
        alert_thresholds: [70, 85, 100],
        alerted_thresholds: [],
    };

    if (!controlRow.enabled) {
        throw new AppError('Funzionalità temporaneamente disattivata dall’amministrazione.', 'FEATURE_DISABLED', 503);
    }

    if (!canBypass && !isPremiumActive) {
        throw new AppError('Funzionalità disponibile solo per utenti premium.', 'PREMIUM_REQUIRED', 403);
    }

    const counters: QuotaCounter[] = [];

    if (!canBypass) {
        const { data: entitlement } = await supabase.from('feature_entitlements')
            .select('enabled, daily_limit, monthly_limit')
            .eq('user_id', userId)
            .eq('feature_key', feature)
            .maybeSingle();

        if (entitlement && entitlement.enabled === false) {
            throw new AppError('Funzionalità premium non abilitata per questo account.', 'FEATURE_NOT_ENTITLED', 403);
        }

        counters.push(
            { feature_key: feature, period_type: 'day', period_start: today, limit: entitlement?.daily_limit ?? DEFAULT_LIMITS[feature].daily },
            { feature_key: feature, period_type: 'month', period_start: monthStart, limit: entitlement?.monthly_limit ?? DEFAULT_LIMITS[feature].monthly },
        );
        if (AI_FEATURES.has(feature)) {
            counters.push({ feature_key: AI_TOTAL_COUNTER, period_type: 'day', period_start: today, limit: AI_DAILY_LIMIT });
        }
    }

    // Every counter and the global daily cap are incremented atomically, or
    // none is (migration 0018): no read-then-write race between requests.
    const { data: globalUsage, error: quotaError } = await supabase.rpc('consume_feature_quota', {
        p_user_id: userId,
        p_feature: feature,
        p_counters: counters,
        p_amount: incrementBy,
    });

    if (quotaError) throw quotaErrorToAppError(quotaError);

    await recordCostAlerts(supabase, feature, controlRow, Number(globalUsage ?? 0), today);
}

function quotaErrorToAppError(error: { message?: string; details?: string | null }): Error {
    if (error.message === 'GLOBAL_DAILY_CAP_REACHED') {
        return new AppError('Limite giornaliero globale raggiunto. Riprova più tardi.', 'GLOBAL_DAILY_CAP_REACHED', 429);
    }
    if (error.message === 'QUOTA_EXCEEDED') {
        const [counter, period] = (error.details ?? '').split(':');
        const known = QUOTA_ERRORS[`${counter}:${period}`] ?? QUOTA_ERRORS[period] ?? QUOTA_ERRORS.day;
        return new AppError(known.message, known.code, 429);
    }
    return new Error(`[motonui][premium][quota] ${error.message ?? 'unknown error'}`);
}

/** Logs and records newly crossed cost-alert thresholds for the global daily cap. */
async function recordCostAlerts(
    supabase: SupabaseClient,
    feature: FeatureKey,
    controlRow: { hard_daily_cap?: number | null; alert_thresholds?: unknown; alerted_thresholds?: unknown; usage_date?: string | null },
    dailyUsage: number,
    today: string,
): Promise<void> {
    const alertThresholds: number[] = Array.isArray(controlRow.alert_thresholds) ? controlRow.alert_thresholds : [70, 85, 100];
    // Thresholds already alerted on a previous day do not count.
    const alreadyAlerted: number[] = controlRow.usage_date === today && Array.isArray(controlRow.alerted_thresholds)
        ? controlRow.alerted_thresholds
        : [];

    const newlyCrossed = computeCrossedThresholds(dailyUsage, Number(controlRow.hard_daily_cap ?? 0), alertThresholds, alreadyAlerted);
    if (newlyCrossed.length === 0) return;

    log.warn('[motonui][premium][cost-alert]', {
        feature,
        hardDailyCap: controlRow.hard_daily_cap,
        dailyUsage,
        thresholds: newlyCrossed,
    });

    await supabase.from('feature_controls')
        .update({ alerted_thresholds: [...alreadyAlerted, ...newlyCrossed].sort((a, b) => a - b) })
        .eq('feature_key', feature);
}

function computeCrossedThresholds(
    usage: number,
    cap: number,
    thresholds: number[],
    alreadyAlerted: number[]
): number[] {
    if (!cap || cap <= 0) return [];
    const pct = Math.floor((usage / cap) * 100);
    return thresholds.filter((t) => pct >= t && !alreadyAlerted.includes(t));
}
