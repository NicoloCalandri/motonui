import { Hono } from 'hono';
import { z } from 'zod';
import { createAdminClient } from '../../lib/supabase/server';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import type { AppEnv } from '../../types';

export const featuresRouter = new Hono<AppEnv>();

const FeatureKeySchema = z.enum(['ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders']);

const UpdateSchema = z.object({
    featureKey: FeatureKeySchema,
    enabled: z.boolean().optional(),
    hardDailyCap: z.number().int().nonnegative().nullable().optional(),
    alertThresholds: z.array(z.number().int().min(1).max(100)).min(1).max(10).optional(),
});

/** GET /api/admin/features — list global feature controls */
featuresRouter.get('/', requireUser, loadProfile, requireAdmin, async (c) => {
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
        .from('feature_controls')
        .select('feature_key, enabled, hard_daily_cap, daily_usage, usage_date, alert_thresholds, alerted_thresholds')
        .order('feature_key', { ascending: true });

    if (error) {
        return c.json({ error: 'Errore nel recupero feature controls.' }, 500);
    }

    return c.json({
        items: (data ?? []).map((item: any) => ({
            featureKey: item.feature_key,
            enabled: Boolean(item.enabled),
            hardDailyCap: item.hard_daily_cap ?? null,
            dailyUsage: item.daily_usage ?? 0,
            usageDate: item.usage_date,
            alertThresholds: item.alert_thresholds ?? [70, 85, 100],
            alertedThresholds: item.alerted_thresholds ?? [],
        })),
    });
});

/** PUT /api/admin/features — update a global feature control (kill switch/caps) */
featuresRouter.put('/', requireUser, loadProfile, requireAdmin, async (c) => {
    const adminId = c.get('adminId');

    const body: unknown = await c.req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Payload non valido.' }, 400);
    }

    const supabase = createAdminClient();
    const payload = parsed.data;

    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: adminId,
    };
    if (payload.enabled !== undefined) updates.enabled = payload.enabled;
    if (payload.hardDailyCap !== undefined) updates.hard_daily_cap = payload.hardDailyCap;
    if (payload.alertThresholds !== undefined) updates.alert_thresholds = payload.alertThresholds;

    const { error } = await (supabase as any)
        .from('feature_controls')
        .update(updates)
        .eq('feature_key', payload.featureKey);

    if (error) {
        return c.json({ error: 'Errore durante aggiornamento feature control.' }, 500);
    }

    await (supabase as any).from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'premium_update',
        target_id: adminId,
        metadata: {
            type: 'feature_control',
            featureKey: payload.featureKey,
            changes: updates,
        },
    });

    return c.json({ updated: true });
});
