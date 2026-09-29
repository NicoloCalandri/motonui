import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok, created } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertRestaurantReminder } from '@/lib/reminders';

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

/** GET /api/trips/[id]/restaurants — list all restaurants for a trip */
export const GET = withRoute(
    { name: 'trips/[id]/restaurants GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;
    const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('trip_id', id)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][restaurants][GET] ${error.message}`);
    return ok(data ?? []);
});

/** POST /api/trips/[id]/restaurants — create a restaurant reservation */
export const POST = withRoute(
    { name: 'trips/[id]/restaurants POST', params: tripParams(), body: CreateRestaurantSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id } = params;
    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert({ ...body, trip_id: id })
        .select()
        .single();

    if (error) throw new Error(`[motonui][restaurants][POST] ${error.message}`);

    // Auto-create expense if cost provided
    if (body.cost && body.cost > 0) {
        const amount_eur = await convertCurrency(body.cost, body.currency, 'EUR', { supabase });
        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: body.day_id ?? null,
            description: `Ristorante: ${body.name}`,
            amount: body.cost,
            currency: body.currency,
            amount_eur,
            category: 'food',
            paid_by: user.id,
            split: true,
            date: body.date ?? null,
        });
    }

    // Create reminder if date and time are set
    if (body.date && body.time) {
        await upsertRestaurantReminder(supabase, {
            userId: user.id,
            tripId: id,
            restaurantId: restaurant.id,
            name: body.name,
            date: body.date,
            time: body.time,
        });
    }

    return created(restaurant);
});
