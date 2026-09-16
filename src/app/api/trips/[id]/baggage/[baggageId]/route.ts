import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember, requireLegInTrip } from '@/lib/authz';

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

type Params = { params: Promise<{ id: string; baggageId: string }> };

export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, baggageId } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = UpdateBaggageItemSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const data = parsed.data;
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
}, 'trips/[id]/baggage/[baggageId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, baggageId } = await params;

    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('baggage_items')
        .delete()
        .eq('id', baggageId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][baggage][DELETE] ${error.message}`);
    return ok({ success: true });
}, 'trips/[id]/baggage/[baggageId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
