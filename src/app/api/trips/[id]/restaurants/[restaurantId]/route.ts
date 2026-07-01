import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';
import { upsertRestaurantReminder } from '@/lib/reminders';

const UpdateRestaurantSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    cuisine_type: z.string().max(100).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    covers: z.coerce.number().int().min(1).optional(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).optional(),
    booking_ref: z.string().max(100).optional().nullable(),
    confirmation_url: z.string().url().optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    day_id: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ id: string; restaurantId: string }> };

/** PUT /api/trips/[id]/restaurants/[restaurantId] */
export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, restaurantId } = await params;
    await requireTripMember(supabase, id, user.id);

    const body: unknown = await request.json();
    const parsed = UpdateRestaurantSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(parsed.data)
        .eq('id', restaurantId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Ristorante');

    // Update reminder
    const date = parsed.data.date ?? restaurant.date;
    const time = parsed.data.time ?? restaurant.time;
    if (date && time) {
        await upsertRestaurantReminder(supabase, {
            userId: user.id,
            tripId: id,
            restaurantId: restaurant.id,
            name: restaurant.name,
            date,
            time,
        });
    }

    return ok(restaurant);
}, 'trips/[id]/restaurants/[restaurantId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

/** DELETE /api/trips/[id]/restaurants/[restaurantId] */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, restaurantId } = await params;
    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId)
        .eq('trip_id', id);

    if (error) throw Errors.notFound('Ristorante');

    // Clean up reminders
    await supabase
        .from('reminders')
        .delete()
        .eq('entity_id', restaurantId)
        .eq('entity_type', 'restaurant');

    return ok({ success: true });
}, 'trips/[id]/restaurants/[restaurantId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
