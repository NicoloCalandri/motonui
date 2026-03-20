import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, created } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertFlightCheckinReminder } from '@/lib/reminders';

const CreateLegSchema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1).max(200),
    to_name: z.string().min(1).max(200),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
    departure_at: z.string().optional().nullable().transform((v) => v || null),
    arrival_at: z.string().optional().nullable().transform((v) => v || null),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    carrier: z.string().max(200).optional().nullable(),
    booking_ref: z.string().max(100).optional().nullable(),
    pnr: z.string().max(20).optional().nullable(),
    checkin_opens_at: z.string().optional().nullable().transform((v) => v || null),
});

type Params = { params: Promise<{ id: string; dayId: string }> };

export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId } = await params;
    const body: unknown = await request.json();
    const parsed = CreateLegSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: leg, error } = await supabase
        .from('legs')
        .insert({
            ...parsed.data,
            trip_id: id,
            day_id: dayId,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][legs][POST] ${error.message}`);

    // If there is a cost, automatically create an expense
    if (parsed.data.cost && parsed.data.cost > 0) {
        const amount_eur = await convertCurrency(parsed.data.cost, parsed.data.currency, 'EUR');
        
        // Fetch the day to get its date
        const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();

        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: dayId,
            description: `Spostamento: ${parsed.data.from_name} → ${parsed.data.to_name}`,
            amount: parsed.data.cost,
            currency: parsed.data.currency,
            amount_eur,
            category: 'transport',
            paid_by: user.id,
            split: true,
            date: day?.date ?? null,
        });
    }

    if (parsed.data.type === 'flight' && parsed.data.checkin_opens_at) {
        await upsertFlightCheckinReminder(supabase, {
            tripId: id,
            userId: user.id,
            legId: leg.id,
            from: leg.from_name ?? '',
            to: leg.to_name ?? '',
            checkinOpensAt: parsed.data.checkin_opens_at,
            carrier: leg.carrier ?? null,
        });
    }

    return created(leg);
}, 'trips/[id]/days/[dayId]/legs POST') as (req: Request, ctx: Params) => Promise<Response>;
