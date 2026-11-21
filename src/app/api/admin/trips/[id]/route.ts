import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import { readJsonBody, withAdminRoute } from '@/lib/api/with-admin-route';

const PatchSchema = z.object({
    status: z.enum(['planning', 'active', 'completed', 'archived']),
});

/** PATCH /api/admin/trips/[id] — update trip status (admin only) */
export const PATCH = withAdminRoute<{ id: string }>('admin/trips/[id] PATCH', async ({ request, params }) => {
    const { id } = params;

    const body: unknown = await readJsonBody(request);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Parametri non validi.', code: 'VALIDATION_ERROR', status: 400 },
            { status: 400 }
        );
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase.from('trips')
        .update({ status: parsed.data.status })
        .eq('id', id)
        .select('id, status')
        .single();

    if (error) {
        // The database message stays in the log (audit A4.23), never in the response.
        log.error('[motonui][admin/trips/[id]][PATCH] update failed', error.message);
        return NextResponse.json(
            { error: 'Impossibile aggiornare il viaggio.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    return NextResponse.json(data);
});
