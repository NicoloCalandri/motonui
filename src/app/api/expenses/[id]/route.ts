import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireDayInTrip, requireTripPayer } from '@/lib/authz';
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

type Params = { params: Promise<{ id: string }> };

/** PUT /api/expenses/[id] — update an expense */
export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateExpenseSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: currentExpense, error: currentExpenseError } = await supabase
        .from('expenses')
        .select('trip_id, amount, currency, paid_by')
        .eq('id', id)
        .single();

    if (currentExpenseError || !currentExpense) throw Errors.notFound('Spesa');

    // Recalculate EUR if amount or currency changed
    let amount_eur: number | undefined;
    if (parsed.data.amount !== undefined || parsed.data.currency !== undefined) {
        const { convertCurrency } = await import('@/lib/expenses');

        // Get current expense to fill in missing values
        const amount = parsed.data.amount ?? currentExpense.amount ?? 0;
        const currency = parsed.data.currency ?? currentExpense.currency ?? 'EUR';
        amount_eur = await convertCurrency(amount, currency, 'EUR');
    }

    await requireDayInTrip(supabase, currentExpense.trip_id, parsed.data.day_id ?? undefined);
    await requireTripPayer(supabase, currentExpense.trip_id, parsed.data.paid_by ?? currentExpense.paid_by);

    const { data: expense, error } = await supabase
        .from('expenses')
        .update({
            ...parsed.data,
            ...(parsed.data.description !== undefined ? { description: sanitizePlainText(parsed.data.description, 500) } : {}),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes, 1000) : null } : {}),
            ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency.toUpperCase() } : {}),
            ...(amount_eur !== undefined ? { amount_eur } : {}),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Spesa');

    return ok(expense);
}, 'expenses/[id] PUT') as (req: Request, ctx: Params) => Promise<Response>;

/** DELETE /api/expenses/[id] — delete an expense */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

    if (error) throw Errors.notFound('Spesa');

    return ok({ success: true });
}, 'expenses/[id] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
