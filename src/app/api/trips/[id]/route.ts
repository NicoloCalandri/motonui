import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';

const UpdateTripSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    destination: z.string().min(1).max(200).optional(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    cover_image: z.string().url().optional().nullable(),
    status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
    budget_eur: z.number().nonnegative().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id] — full trip with days, legs, accommodations */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const { data: trip, error } = await (supabase.from('trips') as any)
        .select(`
      *,
      trip_members (
        id, user_id, role
      ),
      days (
        *,
        legs (*),
        accommodations (*)
      ),
      restaurants (*),
      activities (*),
      documents (*),
      media (count),
      expenses (amount_eur, amount)
    `)
        .eq('id', id)
        .single();

    if (error) throw Errors.notFound('Viaggio');

    return ok(trip);
}, 'trips/[id] GET') as (req: Request, ctx: Params) => Promise<Response>;

/** PUT /api/trips/[id] — update trip metadata */
export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id } = await params;
    await requireTripMember(supabase, id, user.id);
    const body: unknown = await request.json();
    const parsed = UpdateTripSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: trip, error } = await (supabase.from('trips') as any)
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Viaggio');

    return ok(trip);
}, 'trips/[id] PUT') as (req: Request, ctx: Params) => Promise<Response>;

/** DELETE /api/trips/[id] — soft delete (status = 'archived') */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id } = await params;

    const { error } = await (supabase.from('trips') as any)
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('owner_id', user.id); // only owner can archive

    if (error) throw Errors.forbidden();

    return ok({ success: true });
}, 'trips/[id] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
