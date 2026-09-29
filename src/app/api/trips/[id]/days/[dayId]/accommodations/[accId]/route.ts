import { z } from 'zod';
import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { convertCurrency } from '@/lib/expenses';
import { upsertAccommodationReminders } from '@/lib/reminders';

const UpdateAccommodationSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().nullable().optional(),
    check_in: z.string().nullable().optional(),
    check_out: z.string().nullable().optional(),
    cost: z.number().nullable().optional(),
    currency: z.string().optional(),
    notes: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    booking_ref: z.string().max(100).nullable().optional(),
    payment_deadline: z.string().nullable().optional(),
    cancellation_deadline: z.string().nullable().optional(),
});

export const PUT = withRoute(
    { name: 'trips/[id]/days/[dayId]/accommodations/[accId] PUT', params: tripParams('dayId', 'accId'), body: UpdateAccommodationSchema, tripMember: true, dayInTrip: true },
    async ({ supabase, user, params, body }) => {
    const { id, dayId, accId } = params;

    const { data: acc, error } = await supabase
        .from('accommodations')
        .update(body)
        .eq('id', accId)
        .eq('day_id', dayId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Alloggio');

    // Sync the related expense if cost/currency changed
    const expDesc = `Alloggio: ${acc.name}`;
    if (acc.cost && acc.cost > 0) {
        const amount_eur = await convertCurrency(acc.cost, acc.currency, 'EUR');
        const { data: existing } = await supabase
            .from('expenses')
            .select('id')
            .eq('trip_id', id)
            .eq('day_id', dayId)
            .like('description', 'Alloggio:%')
            .single();
        if (existing) {
            await supabase
                .from('expenses')
                .update({ description: expDesc, amount: acc.cost, currency: acc.currency, amount_eur, category: 'accommodation' })
                .eq('id', existing.id);
        } else {
            const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();
            await supabase.from('expenses').insert({
                trip_id: id,
                day_id: dayId,
                description: expDesc,
                amount: acc.cost,
                currency: acc.currency,
                amount_eur,
                category: 'accommodation',
                paid_by: user.id,
                split: true,
                date: day?.date ?? null,
            });
        }
    } else {
        // Cost removed — delete any linked expense
        await supabase
            .from('expenses')
            .delete()
            .eq('trip_id', id)
            .eq('day_id', dayId)
            .like('description', 'Alloggio:%');
    }

    // Keep deadline reminders in sync
    if (acc.payment_deadline !== undefined || acc.cancellation_deadline !== undefined) {
        await upsertAccommodationReminders(supabase, {
            tripId: id,
            userId: user.id,
            accId: acc.id,
            name: acc.name,
            paymentDeadline: acc.payment_deadline ?? null,
            cancellationDeadline: acc.cancellation_deadline ?? null,
        });
    }

    return ok(acc);
});

export const DELETE = withRoute(
    { name: 'trips/[id]/days/[dayId]/accommodations/[accId] DELETE', params: tripParams('dayId', 'accId'), tripMember: true, dayInTrip: true },
    async ({ supabase, params }) => {
    const { id, dayId, accId } = params;

    // Delete linked expense first (if any)
    await supabase
        .from('expenses')
        .delete()
        .eq('trip_id', id)
        .eq('day_id', dayId)
        .like('description', 'Alloggio:%');

    const { error } = await supabase
        .from('accommodations')
        .delete()
        .eq('id', accId)
        .eq('day_id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][accommodations][DELETE] ${error.message}`);

    return ok({ success: true });
});
