import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok } from '@/lib/errors';

const UpdateAccommodationSchema = z.object({
    name: z.string().min(1),
    address: z.string().nullable().optional(),
    check_in: z.string().nullable().optional(),
    check_out: z.string().nullable().optional(),
    cost: z.coerce.number().nullable().optional(),
    currency: z.string().default('EUR'),
    booking_ref: z.string().nullable().optional(),
    payment_deadline: z.string().nullable().optional(),
    cancellation_deadline: z.string().nullable().optional(),
});

export const PUT = withRoute(
    { name: 'trips/[id]/accommodations/[accId] PUT', params: tripParams('accId'), body: UpdateAccommodationSchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id, accId } = params;
    const { error } = await supabase
        .from('accommodations')
        .update(body)
        .eq('id', accId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][accommodations][PUT] ${error.message}`);
    return ok({ success: true });
});

export const DELETE = withRoute(
    { name: 'trips/[id]/accommodations/[accId] DELETE', params: tripParams('accId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, accId } = params;
    const { error } = await supabase
        .from('accommodations')
        .delete()
        .eq('id', accId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][accommodations][DELETE] ${error.message}`);
    return ok({ success: true });
});
