import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok } from '@/lib/errors';
import { requireLegInTrip } from '@/lib/authz';

const CreateBaggageItemSchema = z.object({
    leg_id: z.string().uuid().nullable().optional(),
    category: z.enum(['cabin_bag', 'cabin_trolley', 'checked', 'other']),
    label: z.string().nullable().optional(),
    length_cm: z.number().positive().nullable().optional(),
    width_cm: z.number().positive().nullable().optional(),
    height_cm: z.number().positive().nullable().optional(),
    weight_kg: z.number().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
});

export const GET = withRoute(
    { name: 'trips/[id]/baggage GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;
    const { data, error } = await supabase
        .from('baggage_items')
        .select('*')
        .eq('trip_id', id)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`[motonui][baggage][GET] ${error.message}`);

    return ok(data || []);
});

export const POST = withRoute(
    { name: 'trips/[id]/baggage POST', params: tripParams(), body: CreateBaggageItemSchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id } = params;
    const data = body;
    await requireLegInTrip(supabase, id, data.leg_id);

    const { data: inserted, error } = await supabase
        .from('baggage_items')
        .insert({
            trip_id: id,
            leg_id: data.leg_id ?? null,
            category: data.category,
            label: data.label ?? null,
            length_cm: data.length_cm ?? null,
            width_cm: data.width_cm ?? null,
            height_cm: data.height_cm ?? null,
            weight_kg: data.weight_kg ?? null,
            notes: data.notes ?? null,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][baggage][POST] ${error.message}`);

    return ok(inserted, 201);
});
