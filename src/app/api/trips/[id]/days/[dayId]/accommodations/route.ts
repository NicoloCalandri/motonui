import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, created } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertAccommodationReminders } from '@/lib/reminders';

const CreateAccommodationSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().optional().nullable(),
    check_in: z.string().optional().nullable(),
    check_out: z.string().optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    booking_ref: z.string().max(100).optional().nullable(),
    payment_deadline: z.string().optional().nullable(),
    cancellation_deadline: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string; dayId: string }> };

export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId } = await params;
    const body: unknown = await request.json();
    const parsed = CreateAccommodationSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: acc, error } = await supabase
        .from('accommodations')
        .insert({
            ...parsed.data,
            trip_id: id,
            day_id: dayId,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][accommodations][POST] ${error.message}`);

    // If there is a cost, automatically create an expense
    if (parsed.data.cost && parsed.data.cost > 0) {
        const amount_eur = await convertCurrency(parsed.data.cost, parsed.data.currency, 'EUR');
        
        // Fetch the day to get its date
        const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();

        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: dayId,
            description: `Alloggio: ${parsed.data.name}`,
            amount: parsed.data.cost,
            currency: parsed.data.currency,
            amount_eur,
            category: 'accommodation',
            paid_by: user.id,
            split: true,
            date: day?.date ?? null,
        });
    }

    if (parsed.data.payment_deadline || parsed.data.cancellation_deadline) {
        await upsertAccommodationReminders(supabase, {
            tripId: id,
            userId: user.id,
            accId: acc.id,
            name: acc.name,
            paymentDeadline: parsed.data.payment_deadline ?? null,
            cancellationDeadline: parsed.data.cancellation_deadline ?? null,
        });
    }

    return created(acc);
}, 'trips/[id]/days/[dayId]/accommodations POST') as (req: Request, ctx: Params) => Promise<Response>;
