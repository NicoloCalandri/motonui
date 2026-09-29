import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';
import { AI_DAILY_LIMIT, requireFeatureAccess } from './access';

const { createAdminClientMock } = vi.hoisted(() => ({
    createAdminClientMock: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: createAdminClientMock,
}));

type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message: string; details?: string | null } | null };

const today = new Date().toISOString().slice(0, 10);

function createMockSupabase(seed: {
    profiles?: Row[];
    feature_controls?: Row[];
    feature_entitlements?: Row[];
    rpc?: RpcResult;
}) {
    const tables: Record<string, Row[]> = {
        profiles: seed.profiles ?? [],
        feature_controls: seed.feature_controls ?? [],
        feature_entitlements: seed.feature_entitlements ?? [],
    };
    const updates: Array<{ table: string; payload: Row }> = [];
    const rpc = vi.fn(async () => seed.rpc ?? { data: 1, error: null });

    const from = (table: string) => {
        let rows = [...(tables[table] ?? [])];
        const api = {
            select: () => api,
            eq: (key: string, value: unknown) => {
                rows = rows.filter((r) => r[key] === value);
                return api;
            },
            maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
            single: async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } }),
            update: (payload: Row) => {
                updates.push({ table, payload });
                return { eq: async () => ({ error: null }) };
            },
        };
        return api;
    };

    return { client: { from, rpc }, rpc, updates };
}

const premium = { id: 'u1', role: 'user', plan: 'premium', premium_until: null };
const control = (feature: string, extra: Row = {}) => ({
    feature_key: feature, enabled: true, hard_daily_cap: 1000, daily_usage: 0, usage_date: today,
    alert_thresholds: [70, 85, 100], alerted_thresholds: [], ...extra,
});

describe('requireFeatureAccess', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('blocks free users on premium features without consuming quota', async () => {
        const db = createMockSupabase({
            profiles: [{ ...premium, plan: 'free' }],
            feature_controls: [control('ai_blog')],
        });
        createAdminClientMock.mockResolvedValue(db.client);

        await expect(requireFeatureAccess({ userId: 'u1', feature: 'ai_blog' })).rejects.toMatchObject({ code: 'PREMIUM_REQUIRED' });
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('consumes per-feature day/month counters and the shared AI daily counter in one atomic call', async () => {
        const db = createMockSupabase({
            profiles: [premium],
            feature_controls: [control('ai_destination')],
            feature_entitlements: [{ user_id: 'u1', feature_key: 'ai_destination', enabled: true, daily_limit: 5, monthly_limit: 50 }],
        });
        createAdminClientMock.mockResolvedValue(db.client);

        await expect(requireFeatureAccess({ userId: 'u1', feature: 'ai_destination' })).resolves.toBeUndefined();

        expect(db.rpc).toHaveBeenCalledTimes(1);
        expect(db.rpc).toHaveBeenCalledWith('consume_feature_quota', {
            p_user_id: 'u1',
            p_feature: 'ai_destination',
            p_amount: 1,
            p_counters: [
                { feature_key: 'ai_destination', period_type: 'day', period_start: today, limit: 5 },
                { feature_key: 'ai_destination', period_type: 'month', period_start: `${today.slice(0, 7)}-01`, limit: 50 },
                { feature_key: 'ai_total', period_type: 'day', period_start: today, limit: AI_DAILY_LIMIT },
            ],
        });
    });

    it('does not count non-AI features towards the AI daily limit', async () => {
        const db = createMockSupabase({ profiles: [premium], feature_controls: [control('advanced_reminders')] });
        createAdminClientMock.mockResolvedValue(db.client);

        await requireFeatureAccess({ userId: 'u1', feature: 'advanced_reminders' });

        const [, args] = db.rpc.mock.calls[0] as unknown as [string, { p_counters: Array<{ feature_key: string }> }];
        expect(args.p_counters.map((c) => c.feature_key)).toEqual(['advanced_reminders', 'advanced_reminders']);
    });

    it.each([
        ['instagram_caption:day', 'DAILY_QUOTA_EXCEEDED'],
        ['instagram_caption:month', 'MONTHLY_QUOTA_EXCEEDED'],
        ['ai_total:day', 'AI_DAILY_LIMIT_REACHED'],
    ])('maps a %s quota error to %s (429)', async (details, code) => {
        const db = createMockSupabase({
            profiles: [premium],
            feature_controls: [control('instagram_caption')],
            rpc: { data: null, error: { message: 'QUOTA_EXCEEDED', details } },
        });
        createAdminClientMock.mockResolvedValue(db.client);

        const error = await requireFeatureAccess({ userId: 'u1', feature: 'instagram_caption' }).catch((e) => e);
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ code, status: 429 });
    });

    it('maps the global cap error to 429', async () => {
        const db = createMockSupabase({
            profiles: [premium],
            feature_controls: [control('ai_blog')],
            rpc: { data: null, error: { message: 'GLOBAL_DAILY_CAP_REACHED' } },
        });
        createAdminClientMock.mockResolvedValue(db.client);

        await expect(requireFeatureAccess({ userId: 'u1', feature: 'ai_blog' })).rejects.toMatchObject({ code: 'GLOBAL_DAILY_CAP_REACHED', status: 429 });
    });

    it('lets admins bypass per-user limits but still counts the global usage', async () => {
        const db = createMockSupabase({ profiles: [{ ...premium, role: 'admin', plan: 'free' }], feature_controls: [control('ai_blog')] });
        createAdminClientMock.mockResolvedValue(db.client);

        await requireFeatureAccess({ userId: 'u1', feature: 'ai_blog', allowAdminBypass: true });

        expect(db.rpc).toHaveBeenCalledWith('consume_feature_quota', expect.objectContaining({ p_counters: [] }));
    });

    it('refuses a disabled feature before consuming quota', async () => {
        const db = createMockSupabase({ profiles: [premium], feature_controls: [control('ai_blog', { enabled: false })] });
        createAdminClientMock.mockResolvedValue(db.client);

        await expect(requireFeatureAccess({ userId: 'u1', feature: 'ai_blog' })).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('records newly crossed cost-alert thresholds once', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const db = createMockSupabase({
            profiles: [premium],
            feature_controls: [control('ai_blog', { hard_daily_cap: 100, alerted_thresholds: [70] })],
            rpc: { data: 86, error: null },
        });
        createAdminClientMock.mockResolvedValue(db.client);

        await requireFeatureAccess({ userId: 'u1', feature: 'ai_blog' });

        expect(db.updates).toEqual([{ table: 'feature_controls', payload: { alerted_thresholds: [70, 85] } }]);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});
