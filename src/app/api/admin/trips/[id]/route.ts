import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';

const PatchSchema = z.object({
    status: z.enum(['planning', 'active', 'completed', 'archived']),
});

/** PATCH /api/admin/trips/[id] — update trip status (admin only) */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const body: unknown = await request.json();
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
        return NextResponse.json(
            { error: error.message, code: 'DB_ERROR', status: 500 },
            { status: 500 }
        );
    }

    return NextResponse.json(data);
}
