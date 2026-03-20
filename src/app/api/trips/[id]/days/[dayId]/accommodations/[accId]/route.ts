import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertAccommodationReminders } from '@/lib/reminders';

type Params = { params: Promise<{ id: string; dayId: string; accId: string }> };

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

export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId, accId } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateAccommodationSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: acc, error } = await supabase
        .from('accommodations')
        .update(parsed.data)
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
                paid_by: (await supabase.auth.getUser()).data.user!.id,
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
}, 'trips/[id]/days/[dayId]/accommodations/[accId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId, accId } = await params;

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
}, 'trips/[id]/days/[dayId]/accommodations/[accId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
