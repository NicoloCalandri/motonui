import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, requireParam, readJsonObject } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireDayInTrip, requireTripMember, requireTripPayer } from '../lib/authz';
import { convertCurrency } from '../lib/expenses';
import { sanitizePlainText } from '../lib/sanitize';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/expenses (top-level, NOT nested under /trips/:id): the
// central trip guard does not see these two endpoints, so each one loads the
// expense and checks membership of its trip itself.
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
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const body: unknown = await readJsonObject(c);
        const parsed = UpdateExpenseSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: currentExpense, error: currentExpenseError } = await supabase
            .from('expenses')
            .select('trip_id, amount, currency, paid_by')
            .eq('id', id)
            .single();

        if (currentExpenseError || !currentExpense) throw Errors.notFound('Spesa');
        // The path has no trip id, so the central guard on /api/trips/:id does not apply here.
        await requireTripMember(supabase, currentExpense.trip_id, user.id);

        let amount_eur: number | null | undefined;
        if (parsed.data.amount !== undefined || parsed.data.currency !== undefined) {
            const amount = parsed.data.amount ?? currentExpense.amount ?? 0;
            const currency = parsed.data.currency ?? currentExpense.currency ?? 'EUR';
            amount_eur = await convertCurrency(amount, currency, 'EUR', { supabase });
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
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const { data: currentExpense } = await supabase
            .from('expenses')
            .select('trip_id')
            .eq('id', id)
            .maybeSingle();

        if (!currentExpense) throw Errors.notFound('Spesa');
        // The path has no trip id, so the central guard on /api/trips/:id does not apply here.
        await requireTripMember(supabase, currentExpense.trip_id, user.id);

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id)
            .eq('trip_id', currentExpense.trip_id);

        if (error) throw Errors.notFound('Spesa');

        return ok(c, { success: true });
    }, 'expenses/:id DELETE')
);
