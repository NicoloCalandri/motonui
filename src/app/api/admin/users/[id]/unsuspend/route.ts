import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/unsuspend */
export async function POST(_req: Request, { params }: Params) {
    const { id } = await params;
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    const supabase = await createAdminClient();

    const { error: updateError } = await (supabase.from('profiles') as any)
        .update({ suspended_at: null, suspended_reason: null })
        .eq('id', id);

    if (updateError) {
        console.error('[admin/users/unsuspend]', updateError.message);
        return NextResponse.json(
            { error: 'Impossibile riattivare l\'utente.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    await (supabase.from('admin_audit_log') as any).insert({
        admin_id: adminId,
        action: 'unsuspend',
        target_id: id,
        metadata: null,
    });

    return ok({ unsuspended: true });
}
