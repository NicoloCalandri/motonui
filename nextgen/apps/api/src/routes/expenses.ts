import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireDayInTrip, requireTripPayer } from '../lib/authz';
import { convertCurrency } from '../lib/expenses';
import { sanitizePlainText } from '../lib/sanitize';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/expenses (top-level, NOT nested under /trips/:id — no
// requireTripMember/requireTripMember-style trip-scoping on these two
// endpoints, ported exactly as the original had them)
export const expensesRouter = new Hono<AppEnv>();

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

/** PUT /api/expenses/:id — update an expense */
expensesRouter.put(
    '/:id',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const body: unknown = await c.req.json();
        const parsed = UpdateExpenseSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: currentExpense, error: currentExpenseError } = await supabase
            .from('expenses')
            .select('trip_id, amount, currency, paid_by')
            .eq('id', id)
            .single();

        if (currentExpenseError || !currentExpense) throw Errors.notFound('Spesa');

        let amount_eur: number | undefined;
        if (parsed.data.amount !== undefined || parsed.data.currency !== undefined) {
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

        return ok(c, expense);
    }, 'expenses/:id PUT')
);

/** DELETE /api/expenses/:id — delete an expense */
expensesRouter.delete(
    '/:id',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw Errors.notFound('Spesa');

        return ok(c, { success: true });
    }, 'expenses/:id DELETE')
);
