import { z } from 'zod';
import { created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
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

export const POST = withRoute(
    { name: 'trips/[id]/days/[dayId]/accommodations POST', params: tripParams('dayId'), body: CreateAccommodationSchema, tripMember: true, dayInTrip: true },
    async ({ supabase, user, params, body }) => {
    const { id, dayId } = params;

    const { data: acc, error } = await supabase
        .from('accommodations')
        .insert({
            ...body,
            trip_id: id,
            day_id: dayId,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][accommodations][POST] ${error.message}`);

    // If there is a cost, automatically create an expense
    if (body.cost && body.cost > 0) {
        const amount_eur = await convertCurrency(body.cost, body.currency, 'EUR');
        
        // Fetch the day to get its date
        const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();

        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: dayId,
            description: `Alloggio: ${body.name}`,
            amount: body.cost,
            currency: body.currency,
            amount_eur,
            category: 'accommodation',
            paid_by: user.id,
            split: true,
            date: day?.date ?? null,
        });
    }

    if (body.payment_deadline || body.cancellation_deadline) {
        await upsertAccommodationReminders(supabase, {
            tripId: id,
            userId: user.id,
            accId: acc.id,
            name: acc.name,
            paymentDeadline: body.payment_deadline ?? null,
            cancellationDeadline: body.cancellation_deadline ?? null,
        });
    }

    return created(acc);
});
