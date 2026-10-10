import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok } from '@/lib/errors';
import { requireLegInTrip } from '@/lib/authz';

const UpdateBaggageItemSchema = z.object({
    leg_id: z.string().uuid().nullable().optional(),
    category: z.enum(['cabin_bag', 'cabin_trolley', 'checked', 'other']),
    label: z.string().nullable().optional(),
    length_cm: z.number().positive().nullable().optional(),
    width_cm: z.number().positive().nullable().optional(),
    height_cm: z.number().positive().nullable().optional(),
    weight_kg: z.number().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
});

export const PUT = withRoute(
    { name: 'trips/[id]/baggage/[baggageId] PUT', params: tripParams('baggageId'), body: UpdateBaggageItemSchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id, baggageId } = params;
    const data = body;
    await requireLegInTrip(supabase, id, data.leg_id);

    const { error } = await supabase
        .from('baggage_items')
        .update({
            leg_id: data.leg_id ?? null,
            category: data.category,
            label: data.label ?? null,
            length_cm: data.length_cm ?? null,
            width_cm: data.width_cm ?? null,
            height_cm: data.height_cm ?? null,
            weight_kg: data.weight_kg ?? null,
            notes: data.notes ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', baggageId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][baggage][PUT] ${error.message}`);
    return ok({ success: true });
});

export const DELETE = withRoute(
    { name: 'trips/[id]/baggage/[baggageId] DELETE', params: tripParams('baggageId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, baggageId } = params;
    const { error } = await supabase
        .from('baggage_items')
        .delete()
        .eq('id', baggageId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][baggage][DELETE] ${error.message}`);
    return ok({ success: true });
});
