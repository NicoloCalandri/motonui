import { AppError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/server';

export const FEATURE_KEYS = [
    'ai_blog',
    'ai_generate_post',
    'ai_destination',
    'instagram_caption',
    'advanced_reminders',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

const DEFAULT_LIMITS: Record<FeatureKey, { daily: number; monthly: number }> = {
    ai_blog: { daily: 30, monthly: 300 },
    ai_generate_post: { daily: 10, monthly: 100 },
    ai_destination: { daily: 20, monthly: 200 },
    instagram_caption: { daily: 20, monthly: 200 },
    advanced_reminders: { daily: 100, monthly: 2000 },
};

interface RequireFeatureAccessInput {
    userId: string;
    feature: FeatureKey;
    incrementBy?: number;
    allowAdminBypass?: boolean;
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

    const supabase = await createAdminClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const { data: profile, error: profileError } = await (supabase.from('profiles') as any)
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

    const { data: control } = await (supabase.from('feature_controls') as any)
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

    if (!canBypass) {
        const { data: entitlement } = await (supabase.from('feature_entitlements') as any)
            .select('enabled, daily_limit, monthly_limit')
            .eq('user_id', userId)
            .eq('feature_key', feature)
            .maybeSingle();

        if (entitlement && entitlement.enabled === false) {
            throw new AppError('Funzionalità premium non abilitata per questo account.', 'FEATURE_NOT_ENTITLED', 403);
        }

        const dailyLimit = entitlement?.daily_limit ?? DEFAULT_LIMITS[feature].daily;
        const monthlyLimit = entitlement?.monthly_limit ?? DEFAULT_LIMITS[feature].monthly;

        await enforceUserLimit({
            supabase,
            userId,
            feature,
            periodType: 'day',
            periodStart: today,
            incrementBy,
            limit: dailyLimit,
            errorCode: 'DAILY_QUOTA_EXCEEDED',
            errorMessage: 'Hai raggiunto il limite giornaliero per questa funzionalità premium.',
        });

        await enforceUserLimit({
            supabase,
            userId,
            feature,
            periodType: 'month',
            periodStart: monthStart,
            incrementBy,
            limit: monthlyLimit,
            errorCode: 'MONTHLY_QUOTA_EXCEEDED',
            errorMessage: 'Hai raggiunto il limite mensile per questa funzionalità premium.',
        });
    }

    const usageDate = controlRow.usage_date ?? today;
    const currentDailyUsage = usageDate === today ? Number(controlRow.daily_usage ?? 0) : 0;
    const nextDailyUsage = currentDailyUsage + incrementBy;

    if (
        controlRow.hard_daily_cap !== null &&
        controlRow.hard_daily_cap !== undefined &&
        nextDailyUsage > Number(controlRow.hard_daily_cap)
    ) {
        throw new AppError(
            'Limite giornaliero globale raggiunto. Riprova più tardi.',
            'GLOBAL_DAILY_CAP_REACHED',
            429
        );
    }

    const alertThresholds: number[] = Array.isArray(controlRow.alert_thresholds)
        ? controlRow.alert_thresholds
        : [70, 85, 100];
    const alertedThresholds: number[] = Array.isArray(controlRow.alerted_thresholds)
        ? controlRow.alerted_thresholds
        : [];

    const newlyCrossed = computeCrossedThresholds(
        nextDailyUsage,
        Number(controlRow.hard_daily_cap ?? 0),
        alertThresholds,
        alertedThresholds
    );

    await (supabase.from('feature_controls') as any)
        .upsert({
            feature_key: feature,
            enabled: controlRow.enabled ?? true,
            hard_daily_cap: controlRow.hard_daily_cap ?? null,
            daily_usage: nextDailyUsage,
            usage_date: today,
            alert_thresholds: alertThresholds,
            alerted_thresholds: [...alertedThresholds, ...newlyCrossed].sort((a, b) => a - b),
            updated_at: now.toISOString(),
            updated_by: isAdmin ? userId : null,
        });

    if (newlyCrossed.length > 0) {
        console.warn('[motonui][premium][cost-alert]', {
            feature,
            hardDailyCap: controlRow.hard_daily_cap,
            dailyUsage: nextDailyUsage,
            thresholds: newlyCrossed,
        });
    }
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

async function enforceUserLimit(input: {
    supabase: Awaited<ReturnType<typeof createAdminClient>>;
    userId: string;
    feature: FeatureKey;
    periodType: 'day' | 'month';
    periodStart: string;
    incrementBy: number;
    limit: number;
    errorCode: string;
    errorMessage: string;
}) {
    const {
        supabase,
        userId,
        feature,
        periodType,
        periodStart,
        incrementBy,
        limit,
        errorCode,
        errorMessage,
    } = input;

    const { data: existing } = await (supabase.from('usage_counters') as any)
        .select('id, usage_count')
        .eq('user_id', userId)
        .eq('feature_key', feature)
        .eq('period_type', periodType)
        .eq('period_start', periodStart)
        .maybeSingle();

    const current = Number(existing?.usage_count ?? 0);
    const next = current + incrementBy;
    if (next > limit) {
        throw new AppError(errorMessage, errorCode, 429);
    }

    await (supabase.from('usage_counters') as any).upsert({
        user_id: userId,
        feature_key: feature,
        period_type: periodType,
        period_start: periodStart,
        usage_count: next,
        updated_at: new Date().toISOString(),
    });
}
