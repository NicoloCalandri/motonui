import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';
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

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/restaurants — list all restaurants for a trip */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('trip_id', id)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][restaurants][GET] ${error.message}`);
    return ok(data ?? []);
}, 'trips/[id]/restaurants GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/restaurants — create a restaurant reservation */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const body: unknown = await request.json();
    const parsed = CreateRestaurantSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert({ ...parsed.data, trip_id: id })
        .select()
        .single();

    if (error) throw new Error(`[motonui][restaurants][POST] ${error.message}`);

    // Auto-create expense if cost provided
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

    // Create reminder if date and time are set
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

    return created(restaurant);
}, 'trips/[id]/restaurants POST') as (req: Request, ctx: Params) => Promise<Response>;
