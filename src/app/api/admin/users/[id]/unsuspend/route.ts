import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';
import { log } from '@/lib/log';
import { withAdminRoute } from '@/lib/api/with-admin-route';

/** POST /api/admin/users/[id]/unsuspend */
export const POST = withAdminRoute<{ id: string }>('admin/users/[id]/unsuspend POST', async ({ params, adminId }) => {
    const { id } = params;

    const supabase = await createAdminClient();

    const { error: updateError } = await supabase.from('profiles')
        .update({ suspended_at: null, suspended_reason: null })
        .eq('id', id);

    if (updateError) {
        log.error('[admin/users/unsuspend]', updateError.message);
        return NextResponse.json(
            { error: 'Impossibile riattivare l\'utente.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    await supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'unsuspend',
        target_id: id,
        metadata: null,
    });

    return ok({ unsuspended: true });
});
