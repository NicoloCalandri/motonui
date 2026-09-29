import { z } from 'zod';
import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { idParams } from '@/lib/api/params';
import { requireDayInTrip, requireTripMember, requireTripPayer } from '@/lib/authz';
import { sanitizePlainText } from '@/lib/sanitize';

const UpdateExpenseSchema = z.object({
    description: z.string().min(1).max(500).optional(),
    amount: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    category: z.enum(['food', 'transport', 'accommodation', 'activity', 'shopping', 'other']).optional(),
    paid_by: z.string().uuid().optional(),
    split: z.boolean().optional(),
    date: z.string().optional().nullable(),
    day_id: z.string().uuid().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
});

/** PUT /api/expenses/[id] — update an expense */
export const PUT = withRoute(
    { name: 'expenses/[id] PUT', params: idParams, body: UpdateExpenseSchema },
    async ({ supabase, user, params, body }) => {
    const { id } = params;

    const { data: currentExpense, error: currentExpenseError } = await supabase
        .from('expenses')
        .select('trip_id, amount, currency, paid_by')
        .eq('id', id)
        .single();

    if (currentExpenseError || !currentExpense) throw Errors.notFound('Spesa');
    await requireTripMember(supabase, currentExpense.trip_id, user.id);

    // Recalculate EUR if amount or currency changed
    let amount_eur: number | undefined;
    if (body.amount !== undefined || body.currency !== undefined) {
        const { convertCurrency } = await import('@/lib/expenses');

        // Get current expense to fill in missing values
        const amount = body.amount ?? currentExpense.amount ?? 0;
        const currency = body.currency ?? currentExpense.currency ?? 'EUR';
        amount_eur = await convertCurrency(amount, currency, 'EUR');
    }

    await requireDayInTrip(supabase, currentExpense.trip_id, body.day_id ?? undefined);
    await requireTripPayer(supabase, currentExpense.trip_id, body.paid_by ?? currentExpense.paid_by);

    const { data: expense, error } = await supabase
        .from('expenses')
        .update({
            ...body,
            ...(body.description !== undefined ? { description: sanitizePlainText(body.description, 500) } : {}),
            ...(body.notes !== undefined ? { notes: body.notes ? sanitizePlainText(body.notes, 1000) : null } : {}),
            ...(body.currency !== undefined ? { currency: body.currency.toUpperCase() } : {}),
            ...(amount_eur !== undefined ? { amount_eur } : {}),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Spesa');

    return ok(expense);
});

/** DELETE /api/expenses/[id] — delete an expense */
export const DELETE = withRoute(
    { name: 'expenses/[id] DELETE', params: idParams },
    async ({ supabase, user, params }) => {
    const { id } = params;

    const { data: expense } = await supabase
        .from('expenses')
        .select('trip_id')
        .eq('id', id)
        .single();
    if (!expense) throw Errors.notFound('Spesa');
    await requireTripMember(supabase, expense.trip_id, user.id);

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('trip_id', expense.trip_id);

    if (error) throw Errors.notFound('Spesa');

    return ok({ success: true });
});
