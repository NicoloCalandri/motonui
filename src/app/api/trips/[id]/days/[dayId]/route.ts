import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';

const UpdateDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    title: z.string().max(200).optional().nullable(),
});

type Params = { params: Promise<{ id: string; dayId: string }> };

export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, dayId } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = UpdateDaySchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: day, error } = await supabase
        .from('days')
        .update(parsed.data)
        .eq('id', dayId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw new Error(`[motonui][days][PUT] ${error.message}`);
    if (!day) throw Errors.notFound('Giorno');

    return ok(day);
}, 'trips/[id]/days/[dayId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, dayId } = await params;

    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('days')
        .delete()
        .eq('id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][days][DELETE] ${error.message}`);

    return ok({ success: true });
}, 'trips/[id]/days/[dayId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
