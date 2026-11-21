import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';
import { log } from '@/lib/log';
import { readJsonBody, withAdminRoute } from '@/lib/api/with-admin-route';

const SuspendSchema = z.object({
    reason: z.string().min(1).max(500),
});

/** POST /api/admin/users/[id]/suspend */
export const POST = withAdminRoute<{ id: string }>('admin/users/[id]/suspend POST', async ({ request, params, adminId }) => {
    const { id } = params;

    if (adminId === id) {
        return NextResponse.json(
            { error: 'Non puoi sospendere il tuo stesso account.', code: 'FORBIDDEN', status: 403 },
            { status: 403 }
        );
    }

    const body: unknown = await readJsonBody(request);
    const parsed = SuspendSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Motivo di sospensione mancante.', code: 'VALIDATION_ERROR', status: 400 },
            { status: 400 }
        );
    }

    const supabase = await createAdminClient();

    const { error: updateError } = await supabase.from('profiles')
        .update({
            suspended_at: new Date().toISOString(),
            suspended_reason: parsed.data.reason,
        })
        .eq('id', id);

    if (updateError) {
        log.error('[admin/users/suspend]', updateError.message);
        return NextResponse.json(
            { error: 'Impossibile sospendere l\'utente.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    await supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'suspend',
        target_id: id,
        metadata: { reason: parsed.data.reason },
    });

    return ok({ suspended: true });
});
