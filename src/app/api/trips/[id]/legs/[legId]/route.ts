import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';

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

type Params = { params: Promise<{ id: string; legId: string }> };

export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, legId } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = UpdateLegSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { error } = await supabase
        .from('legs')
        .update(parsed.data)
        .eq('id', legId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][legs][PUT] ${error.message}`);
    return ok({ success: true });
}, 'trips/[id]/legs/[legId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, legId } = await params;

    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('legs')
        .delete()
        .eq('id', legId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][legs][DELETE] ${error.message}`);
    return ok({ success: true });
}, 'trips/[id]/legs/[legId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
