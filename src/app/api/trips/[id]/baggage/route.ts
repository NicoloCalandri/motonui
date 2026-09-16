import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember, requireLegInTrip } from '@/lib/authz';

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

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;

    await requireTripMember(supabase, id, user.id);

    const { data, error } = await supabase
        .from('baggage_items')
        .select('*')
        .eq('trip_id', id)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`[motonui][baggage][GET] ${error.message}`);

    return ok(data || []);
}, 'trips/[id]/baggage GET') as (req: Request, ctx: Params) => Promise<Response>;

export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = CreateBaggageItemSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const data = parsed.data;
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
}, 'trips/[id]/baggage POST') as (req: Request, ctx: Params) => Promise<Response>;
