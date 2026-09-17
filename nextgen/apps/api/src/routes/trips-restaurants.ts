import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { convertCurrency } from '../lib/expenses';
import { upsertRestaurantReminder } from '../lib/reminders';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/restaurants
export const tripsRestaurantsRouter = new Hono<AppEnv>();

const CreateRestaurantSchema = z.object({
    name: z.string().min(1).max(200),
    cuisine_type: z.string().max(100).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    covers: z.coerce.number().int().min(1).default(2),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    booking_ref: z.string().max(100).optional().nullable(),
    confirmation_url: z.string().url().optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    day_id: z.string().uuid().optional().nullable(),
});

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

/** GET /api/trips/:id/restaurants — list all restaurants for a trip */
tripsRestaurantsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const { data, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('trip_id', id)
            .order('date', { ascending: true });

        if (error) throw new Error(`[motonui][restaurants][GET] ${error.message}`);
        return ok(c, data ?? []);
    }, 'trips/:id/restaurants GET')
);

/** POST /api/trips/:id/restaurants — create a restaurant reservation */
tripsRestaurantsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
        const parsed = CreateRestaurantSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .insert({ ...parsed.data, trip_id: id })
            .select()
            .single();

        if (error) throw new Error(`[motonui][restaurants][POST] ${error.message}`);

        if (parsed.data.cost && parsed.data.cost > 0) {
            const amount_eur = await convertCurrency(parsed.data.cost, parsed.data.currency, 'EUR');
            await supabase.from('expenses').insert({
                trip_id: id,
                day_id: parsed.data.day_id ?? null,
                description: `Ristorante: ${parsed.data.name}`,
                amount: parsed.data.cost,
                currency: parsed.data.currency,
                amount_eur,
                category: 'food',
                paid_by: user.id,
                split: true,
                date: parsed.data.date ?? null,
            });
        }

        if (parsed.data.date && parsed.data.time) {
            await upsertRestaurantReminder(supabase, {
                userId: user.id,
                tripId: id,
                restaurantId: restaurant.id,
                name: parsed.data.name,
                date: parsed.data.date,
                time: parsed.data.time,
            });
        }

        return created(c, restaurant);
    }, 'trips/:id/restaurants POST')
);

/** PUT /api/trips/:id/restaurants/:restaurantId */
tripsRestaurantsRouter.put(
    '/:restaurantId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const restaurantId = requireParam(c, 'restaurantId');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
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

        return ok(c, restaurant);
    }, 'trips/:id/restaurants/:restaurantId PUT')
);

/** DELETE /api/trips/:id/restaurants/:restaurantId */
tripsRestaurantsRouter.delete(
    '/:restaurantId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const restaurantId = requireParam(c, 'restaurantId');
        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('restaurants')
            .delete()
            .eq('id', restaurantId)
            .eq('trip_id', id);

        if (error) throw Errors.notFound('Ristorante');

        await (supabase as any)
            .from('reminders')
            .delete()
            .eq('entity_id', restaurantId)
            .eq('entity_type', 'restaurant');

        return ok(c, { success: true });
    }, 'trips/:id/restaurants/:restaurantId DELETE')
);
