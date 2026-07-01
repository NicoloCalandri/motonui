import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient, type AppDatabase } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

const DeleteSchema = z.object({
    confirmEmail: z.string().email(),
});

const UpdateSchema = z.object({
    displayName: z.string().min(1).optional(),
    role: z.enum(['user', 'admin']).optional(),
    plan: z.enum(['free', 'premium']).optional(),
    premiumUntil: z.string().datetime().nullable().optional(),
    premiumReason: z.string().max(500).optional(),
    entitlements: z.array(z.object({
        featureKey: z.enum(['ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders']),
        enabled: z.boolean().default(true),
        dailyLimit: z.number().int().nonnegative().nullable().optional(),
        monthlyLimit: z.number().int().nonnegative().nullable().optional(),
    })).optional(),
});

type Params = { params: Promise<{ id: string }> };
type ProfileUpdate = AppDatabase['public']['Tables']['profiles']['Update'];

async function writeAuditLog(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    adminId: string,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>
) {
    await supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        action,
        target_id: targetId,
        metadata: metadata ?? null,
    });
}

/** GET /api/admin/users/[id] — full profile of a single user */
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    const supabase = await createAdminClient();

    const { data: userRow, error } = await supabase.from('admin_user_view')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !userRow) {
        return NextResponse.json(
            { error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 },
            { status: 404 }
        );
    }

    const [tripsRes, postsRes, expensesRes] = await Promise.all([
        supabase.from('trips')
            .select('id, title, destination, status, start_date, end_date')
            .eq('owner_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
        supabase.from('posts')
            .select('id, title, status, published_at')
            .eq('author_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
        supabase.from('expenses')
            .select('amount_eur, currency')
            .eq('paid_by', id),
    ]);

    // Expense totals by currency
    const expensesByCurrency: Record<string, number> = {};
    for (const exp of expensesRes.data ?? []) {
        expensesByCurrency[exp.currency] = (expensesByCurrency[exp.currency] ?? 0) + Number(exp.amount_eur ?? 0);
    }

    await writeAuditLog(supabase, adminId, 'view_profile', id);

    return ok({
        user: {
            id: userRow.id,
            email: userRow.email,
            displayName: userRow.display_name ?? '',
            avatarUrl: userRow.avatar_url ?? null,
            role: userRow.role,
            plan: userRow.plan ?? 'free',
            premiumUntil: userRow.premium_until ?? null,
            premiumEnabledAt: userRow.premium_enabled_at ?? null,
            premiumEnabledBy: userRow.premium_enabled_by ?? null,
            suspendedAt: userRow.suspended_at ?? null,
            suspendedReason: userRow.suspended_reason ?? null,
            createdAt: userRow.created_at,
            lastSignInAt: userRow.last_sign_in_at ?? null,
        },
        recentTrips: tripsRes.data ?? [],
        recentPosts: postsRes.data ?? [],
        expensesByCurrency,
        entitlements: await loadEntitlements(supabase, id),
    });
}

/** PUT /api/admin/users/[id] — update a user */
export async function PUT(request: Request, { params }: Params) {
    const { id } = await params;
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    if (adminId === id) {
        return NextResponse.json(
            { error: 'Non puoi modificare il tuo stesso ruolo qui.', code: 'FORBIDDEN', status: 403 },
            { status: 403 }
        );
    }

    const body: unknown = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Dati non validi.', code: 'VALIDATION_ERROR', status: 400 },
            { status: 400 }
        );
    }

    const supabase = await createAdminClient();

    const updates: ProfileUpdate = {};
    if (parsed.data.displayName !== undefined) updates.display_name = parsed.data.displayName;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.plan !== undefined) updates.plan = parsed.data.plan;
    if (parsed.data.premiumUntil !== undefined) updates.premium_until = parsed.data.premiumUntil;

    if (parsed.data.plan === 'premium') {
        updates.premium_enabled_at = new Date().toISOString();
        updates.premium_enabled_by = adminId;
    }
    if (parsed.data.plan === 'free') {
        updates.premium_until = null;
    }

    if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) {
            console.error('[admin/users PUT]', error.message);
            return NextResponse.json(
                { error: 'Errore durante l\'aggiornamento.', code: 'INTERNAL_ERROR', status: 500 },
                { status: 500 }
            );
        }
    }

    if (parsed.data.entitlements) {
        for (const entitlement of parsed.data.entitlements) {
            await supabase.from('feature_entitlements').upsert({
                user_id: id,
                feature_key: entitlement.featureKey,
                enabled: entitlement.enabled,
                daily_limit: entitlement.dailyLimit ?? null,
                monthly_limit: entitlement.monthlyLimit ?? null,
                updated_at: new Date().toISOString(),
            });
        }
    }

    const changedPremiumFields = parsed.data.plan !== undefined
        || parsed.data.premiumUntil !== undefined
        || parsed.data.entitlements !== undefined;
    await writeAuditLog(
        supabase,
        adminId,
        changedPremiumFields ? 'premium_update' : 'update_user',
        id,
        {
            ...updates,
            premiumReason: parsed.data.premiumReason ?? null,
            entitlements: parsed.data.entitlements ?? null,
        }
    );

    return ok({ updated: true });
}

/** DELETE /api/admin/users/[id] — delete a user (requires email confirmation) */
export async function DELETE(request: Request, { params }: Params) {
    const { id } = await params;
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    if (adminId === id) {
        return NextResponse.json(
            { error: 'Non puoi eliminare il tuo stesso account.', code: 'FORBIDDEN', status: 403 },
            { status: 403 }
        );
    }

    const body: unknown = await request.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Email di conferma mancante.', code: 'VALIDATION_ERROR', status: 400 },
            { status: 400 }
        );
    }

    const supabase = await createAdminClient();

    // Fetch target user email to verify confirmation
    const { data: userRow } = await supabase.from('admin_user_view')
        .select('email')
        .eq('id', id)
        .single();

    if (!userRow) {
        return NextResponse.json(
            { error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 },
            { status: 404 }
        );
    }

    if (userRow.email !== parsed.data.confirmEmail) {
        return NextResponse.json(
            { error: 'Email di conferma non corrisponde.', code: 'VALIDATION_ERROR', status: 400 },
            { status: 400 }
        );
    }

    // Write audit log before deletion (target_id preserved for history)
    await writeAuditLog(supabase, adminId, 'delete', id, { email: userRow.email });

    // Delete from auth.users — cascade deletes profile and all related data
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
        console.error('[admin/users DELETE]', error.message);
        return NextResponse.json(
            { error: 'Impossibile eliminare l\'utente.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    return ok({ deleted: true });
}

async function loadEntitlements(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    userId: string
) {
    const { data } = await supabase.from('feature_entitlements')
        .select('feature_key, enabled, daily_limit, monthly_limit')
        .eq('user_id', userId)
        .order('feature_key', { ascending: true });
    return (data ?? []).map((e) => ({
        featureKey: e.feature_key,
        enabled: Boolean(e.enabled),
        dailyLimit: e.daily_limit ?? null,
        monthlyLimit: e.monthly_limit ?? null,
    }));
}
