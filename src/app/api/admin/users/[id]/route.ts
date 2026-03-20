import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

const DeleteSchema = z.object({
    confirmEmail: z.string().email(),
});

type Params = { params: Promise<{ id: string }> };

async function writeAuditLog(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    adminId: string,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>
) {
    await (supabase.from('admin_audit_log') as any).insert({
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

    const { data: userRow, error } = await (supabase.from('admin_user_view') as any)
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
        (supabase.from('trips') as any)
            .select('id, title, destination, status, start_date, end_date')
            .eq('owner_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
        (supabase.from('posts') as any)
            .select('id, title, status, published_at')
            .eq('author_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
        (supabase.from('expenses') as any)
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
            suspendedAt: userRow.suspended_at ?? null,
            suspendedReason: userRow.suspended_reason ?? null,
            createdAt: userRow.created_at,
            lastSignInAt: userRow.last_sign_in_at ?? null,
        },
        recentTrips: tripsRes.data ?? [],
        recentPosts: postsRes.data ?? [],
        expensesByCurrency,
    });
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
    const { data: userRow } = await (supabase.from('admin_user_view') as any)
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
