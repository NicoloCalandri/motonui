import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { Errors, ok } from '@/lib/errors';

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

/** GET /api/trips/[id] — full trip with days, legs, accommodations */
export const GET = withRoute(
    { name: 'trips/[id] GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;
    const { data: trip, error } = await supabase.from('trips')
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

  
  if (error) {
    console.error('Supabase GET trip error:', error);
    // If supabase returns a 0 (no rows) treat as not found
    throw Errors.notFound('Viaggio');
  }


    return ok(trip);
});

/** PUT /api/trips/[id] — update trip metadata */
export const PUT = withRoute(
    { name: 'trips/[id] PUT', params: tripParams(), body: UpdateTripSchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id } = params;
    const { data: trip, error } = await supabase.from('trips')
        .update(body)
        .eq('id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Viaggio');

    return ok(trip);
});

/** DELETE /api/trips/[id] — soft delete (status = 'archived') */
export const DELETE = withRoute(
    { name: 'trips/[id] DELETE', params: tripParams(), tripMember: true },
    async ({ supabase, user, params }) => {
    const { id } = params;
    const { error } = await supabase.from('trips')
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('owner_id', user.id); // only owner can archive

    if (error) throw Errors.forbidden();

    return ok({ success: true });
});
