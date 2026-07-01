import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

const FeatureKeySchema = z.enum(['ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders']);

const UpdateSchema = z.object({
    featureKey: FeatureKeySchema,
    enabled: z.boolean().optional(),
    hardDailyCap: z.number().int().nonnegative().nullable().optional(),
    alertThresholds: z.array(z.number().int().min(1).max(100)).min(1).max(10).optional(),
});

/** GET /api/admin/features — list global feature controls */
export async function GET() {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const supabase = await createAdminClient();
    const { data, error } = await supabase.from('feature_controls')
        .select('feature_key, enabled, hard_daily_cap, daily_usage, usage_date, alert_thresholds, alerted_thresholds')
        .order('feature_key', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Errore nel recupero feature controls.' }, { status: 500 });
    }

    return ok({
        items: (data ?? []).map((item) => ({
            featureKey: item.feature_key,
            enabled: Boolean(item.enabled),
            hardDailyCap: item.hard_daily_cap ?? null,
            dailyUsage: item.daily_usage ?? 0,
            usageDate: item.usage_date,
            alertThresholds: item.alert_thresholds ?? [70, 85, 100],
            alertedThresholds: item.alerted_thresholds ?? [],
        })),
    });
}

/** PUT /api/admin/features — update a global feature control (kill switch/caps) */
export async function PUT(request: Request) {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    const body: unknown = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Payload non valido.' }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const payload = parsed.data;

    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: adminId,
    };
    if (payload.enabled !== undefined) updates.enabled = payload.enabled;
    if (payload.hardDailyCap !== undefined) updates.hard_daily_cap = payload.hardDailyCap;
    if (payload.alertThresholds !== undefined) updates.alert_thresholds = payload.alertThresholds;

    const { error } = await supabase.from('feature_controls')
        .update(updates)
        .eq('feature_key', payload.featureKey);

    if (error) {
        return NextResponse.json({ error: 'Errore durante aggiornamento feature control.' }, { status: 500 });
    }

    await supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'premium_update',
        target_id: adminId,
        metadata: {
            type: 'feature_control',
            featureKey: payload.featureKey,
            changes: updates,
        },
    });

    return ok({ updated: true });
}
