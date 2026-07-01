import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';
import { requireFeatureAccess } from './access';

const { createAdminClientMock } = vi.hoisted(() => ({
    createAdminClientMock: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: createAdminClientMock,
}));

type Row = Record<string, unknown>;

type QueryApi = {
    select: () => QueryApi;
    eq: (key: string, value: unknown) => QueryApi;
    maybeSingle: () => Promise<{ data: Row | null; error: null }>;
    single: () => Promise<{ data: Row | null; error: { message: string } | null }>;
    upsert: (payload: Row) => Promise<{ data: Row; error: null }>;
};

function createMockSupabase(seed?: {
    profiles?: Row[];
    feature_controls?: Row[];
    feature_entitlements?: Row[];
    usage_counters?: Row[];
}) {
    const db = {
        profiles: seed?.profiles ?? [],
        feature_controls: seed?.feature_controls ?? [],
        feature_entitlements: seed?.feature_entitlements ?? [],
        usage_counters: seed?.usage_counters ?? [],
    };

    const build = (table: keyof typeof db) => {
        let rows = [...db[table]];

        const api: QueryApi = {
            select: () => api,
            eq: (key: string, value: unknown) => {
                rows = rows.filter((r) => r[key] === value);
                return api;
            },
            maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
            single: async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } }),
            upsert: async (payload: Row) => {
                if (table === 'usage_counters') {
                    const idx = db.usage_counters.findIndex((r) =>
                        r.user_id === payload.user_id &&
                        r.feature_key === payload.feature_key &&
                        r.period_type === payload.period_type &&
                        r.period_start === payload.period_start
                    );
                    if (idx >= 0) db.usage_counters[idx] = { ...db.usage_counters[idx], ...payload };
                    else db.usage_counters.push(payload);
                }
                if (table === 'feature_controls') {
                    const idx = db.feature_controls.findIndex((r) => r.feature_key === payload.feature_key);
                    if (idx >= 0) db.feature_controls[idx] = { ...db.feature_controls[idx], ...payload };
                    else db.feature_controls.push(payload);
                }
                return { data: payload, error: null };
            },
        };
        return api;
    };

    return {
        from: (table: keyof typeof db) => build(table),
    };
}

describe('requireFeatureAccess', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('blocks free users on premium features', async () => {
        createAdminClientMock.mockResolvedValue(
            createMockSupabase({
                profiles: [{ id: 'u1', role: 'user', plan: 'free', premium_until: null }],
                feature_controls: [{ feature_key: 'ai_blog', enabled: true, hard_daily_cap: 1000, daily_usage: 0, usage_date: new Date().toISOString().slice(0, 10), alert_thresholds: [70, 85, 100], alerted_thresholds: [] }],
            })
        );

        await expect(
            requireFeatureAccess({ userId: 'u1', feature: 'ai_blog' })
        ).rejects.toBeInstanceOf(AppError);
    });

    it('allows premium users under limits', async () => {
        createAdminClientMock.mockResolvedValue(
            createMockSupabase({
                profiles: [{ id: 'u2', role: 'user', plan: 'premium', premium_until: null }],
                feature_controls: [{ feature_key: 'ai_destination', enabled: true, hard_daily_cap: 1000, daily_usage: 0, usage_date: new Date().toISOString().slice(0, 10), alert_thresholds: [70, 85, 100], alerted_thresholds: [] }],
                feature_entitlements: [{ user_id: 'u2', feature_key: 'ai_destination', enabled: true, daily_limit: 5, monthly_limit: 50 }],
                usage_counters: [],
            })
        );

        await expect(
            requireFeatureAccess({ userId: 'u2', feature: 'ai_destination' })
        ).resolves.toBeUndefined();
    });

    it('blocks when daily entitlement limit is exceeded', async () => {
        const today = new Date().toISOString().slice(0, 10);
        createAdminClientMock.mockResolvedValue(
            createMockSupabase({
                profiles: [{ id: 'u3', role: 'user', plan: 'premium', premium_until: null }],
                feature_controls: [{ feature_key: 'instagram_caption', enabled: true, hard_daily_cap: 1000, daily_usage: 0, usage_date: today, alert_thresholds: [70, 85, 100], alerted_thresholds: [] }],
                feature_entitlements: [{ user_id: 'u3', feature_key: 'instagram_caption', enabled: true, daily_limit: 1, monthly_limit: 100 }],
                usage_counters: [{ user_id: 'u3', feature_key: 'instagram_caption', period_type: 'day', period_start: today, usage_count: 1 }],
            })
        );

        await expect(
            requireFeatureAccess({ userId: 'u3', feature: 'instagram_caption' })
        ).rejects.toBeInstanceOf(AppError);
    });
});
