import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';
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

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/activities — list all activities for a trip */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('trip_id', id)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][activities][GET] ${error.message}`);
    return ok(data ?? []);
}, 'trips/[id]/activities GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/activities — create an activity */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const body: unknown = await request.json();
    const parsed = CreateActivitySchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: activity, error } = await supabase
        .from('activities')
        .insert({ ...parsed.data, trip_id: id })
        .select()
        .single();

    if (error) throw new Error(`[motonui][activities][POST] ${error.message}`);

    // Auto-create expense if cost provided
    if (parsed.data.cost && parsed.data.cost > 0) {
        const amount_eur = await convertCurrency(parsed.data.cost, parsed.data.currency, 'EUR');
        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: parsed.data.day_id ?? null,
            description: `Attività: ${parsed.data.name}`,
            amount: parsed.data.cost,
            currency: parsed.data.currency,
            amount_eur,
            category: 'activity',
            paid_by: user.id,
            split: true,
            date: parsed.data.date ?? null,
        });
    }

    // Create reminder if date and time are set
    if (parsed.data.date && parsed.data.time) {
        await upsertActivityReminder(supabase, {
            userId: user.id,
            tripId: id,
            activityId: activity.id,
            name: parsed.data.name,
            date: parsed.data.date,
            time: parsed.data.time,
        });
    }

    return created(activity);
}, 'trips/[id]/activities POST') as (req: Request, ctx: Params) => Promise<Response>;
