import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';

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

type Params = { params: Promise<{ id: string; accId: string }> };

export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, accId } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = UpdateAccommodationSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { error } = await supabase
        .from('accommodations')
        .update(parsed.data)
        .eq('id', accId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][accommodations][PUT] ${error.message}`);
    return ok({ success: true });
}, 'trips/[id]/accommodations/[accId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, accId } = await params;

    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('accommodations')
        .delete()
        .eq('id', accId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][accommodations][DELETE] ${error.message}`);
    return ok({ success: true });
}, 'trips/[id]/accommodations/[accId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
