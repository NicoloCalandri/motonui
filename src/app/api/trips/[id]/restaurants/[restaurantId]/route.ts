import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { Errors, ok } from '@/lib/errors';
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

/** PUT /api/trips/[id]/restaurants/[restaurantId] */
export const PUT = withRoute(
    { name: 'trips/[id]/restaurants/[restaurantId] PUT', params: tripParams('restaurantId'), body: UpdateRestaurantSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id, restaurantId } = params;
    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(body)
        .eq('id', restaurantId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Ristorante');

    // Update reminder
    const date = body.date ?? restaurant.date;
    const time = body.time ?? restaurant.time;
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
});

/** DELETE /api/trips/[id]/restaurants/[restaurantId] */
export const DELETE = withRoute(
    { name: 'trips/[id]/restaurants/[restaurantId] DELETE', params: tripParams('restaurantId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, restaurantId } = params;
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
});
