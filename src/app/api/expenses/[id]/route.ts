import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok } from '@/lib/errors';

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

    // Recalculate EUR if amount or currency changed
    let amount_eur: number | undefined;
    if (parsed.data.amount !== undefined || parsed.data.currency !== undefined) {
        const { convertCurrency } = await import('@/lib/expenses');

        // Get current expense to fill in missing values
        const { data: current } = await supabase
            .from('expenses')
            .select('amount, currency')
            .eq('id', id)
            .single();

        const amount = parsed.data.amount ?? current?.amount ?? 0;
        const currency = parsed.data.currency ?? current?.currency ?? 'EUR';
        amount_eur = await convertCurrency(amount, currency, 'EUR');
    }

    const { data: expense, error } = await supabase
        .from('expenses')
        .update({ ...parsed.data, ...(amount_eur !== undefined ? { amount_eur } : {}) })
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
