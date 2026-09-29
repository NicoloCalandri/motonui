import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok } from '@/lib/errors';
import { removeLegFiles } from '@/lib/trip-storage';

const UpdateLegSchema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1),
    to_name: z.string().min(1),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
    departure_at: z.string().nullable().optional(),
    arrival_at: z.string().nullable().optional(),
    cost: z.coerce.number().nullable().optional(),
    currency: z.string().default('EUR'),
    carrier: z.string().nullable().optional(),
    booking_ref: z.string().nullable().optional(),
    pnr: z.string().nullable().optional(),
    checkin_opens_at: z.string().nullable().optional(),
});

export const PUT = withRoute(
    { name: 'trips/[id]/legs/[legId] PUT', params: tripParams('legId'), body: UpdateLegSchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id, legId } = params;
    const { error } = await supabase
        .from('legs')
        .update(body)
        .eq('id', legId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][legs][PUT] ${error.message}`);
    return ok({ success: true });
});

export const DELETE = withRoute(
    { name: 'trips/[id]/legs/[legId] DELETE', params: tripParams('legId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, legId } = params;
    const { data: leg, error } = await supabase
        .from('legs')
        .delete()
        .eq('id', legId)
        .eq('trip_id', id)
        .select('boarding_pass_path, boarding_pass_url')
        .maybeSingle();

    if (error) throw new Error(`[motonui][legs][DELETE] ${error.message}`);

    // The boarding pass file goes with the leg (T-2.3).
    if (leg) await removeLegFiles(id, leg);
    return ok({ success: true });
});
