import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { Errors, ok } from '@/lib/errors';

const UpdateDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    title: z.string().max(200).optional().nullable(),
});

export const PUT = withRoute(
    { name: 'trips/[id]/days/[dayId] PUT', params: tripParams('dayId'), body: UpdateDaySchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id, dayId } = params;
    const { data: day, error } = await supabase
        .from('days')
        .update(body)
        .eq('id', dayId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw new Error(`[motonui][days][PUT] ${error.message}`);
    if (!day) throw Errors.notFound('Giorno');

    return ok(day);
});

export const DELETE = withRoute(
    { name: 'trips/[id]/days/[dayId] DELETE', params: tripParams('dayId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, dayId } = params;
    const { error } = await supabase
        .from('days')
        .delete()
        .eq('id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][days][DELETE] ${error.message}`);

    return ok({ success: true });
});
