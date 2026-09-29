import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok, created } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertActivityReminder } from '@/lib/reminders';

const CreateActivitySchema = z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['museum', 'tour', 'excursion', 'show', 'sport', 'other']).default('tour'),
    address: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    duration_min: z.coerce.number().int().min(1).optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    booking_ref: z.string().max(100).optional().nullable(),
    ticket_url: z.string().url().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    day_id: z.string().uuid().optional().nullable(),
});

/** GET /api/trips/[id]/activities — list all activities for a trip */
export const GET = withRoute(
    { name: 'trips/[id]/activities GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('trip_id', id)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][activities][GET] ${error.message}`);
    return ok(data ?? []);
});

/** POST /api/trips/[id]/activities — create an activity */
export const POST = withRoute(
    { name: 'trips/[id]/activities POST', params: tripParams(), body: CreateActivitySchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id } = params;
    const { data: activity, error } = await supabase
        .from('activities')
        .insert({ ...body, trip_id: id })
        .select()
        .single();

    if (error) throw new Error(`[motonui][activities][POST] ${error.message}`);

    // Auto-create expense if cost provided
    if (body.cost && body.cost > 0) {
        const amount_eur = await convertCurrency(body.cost, body.currency, 'EUR', { supabase });
        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: body.day_id ?? null,
            description: `Attività: ${body.name}`,
            amount: body.cost,
            currency: body.currency,
            amount_eur,
            category: 'activity',
            paid_by: user.id,
            split: true,
            date: body.date ?? null,
        });
    }

    // Create reminder if date and time are set
    if (body.date && body.time) {
        await upsertActivityReminder(supabase, {
            userId: user.id,
            tripId: id,
            activityId: activity.id,
            name: body.name,
            date: body.date,
            time: body.time,
        });
    }

    return created(activity);
});
