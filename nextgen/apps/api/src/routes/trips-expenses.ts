import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember, requireDayInTrip, requireTripPayer } from '../lib/authz';
import { getTripExpenseSummary, convertCurrency, splitExpenses } from '../lib/expenses';
import { sanitizePlainText } from '../lib/sanitize';
import type { Expense } from '@motonui/shared-types';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/expenses
export const tripsExpensesRouter = new Hono<AppEnv>();

const CreateExpenseSchema = z.object({
    description: z.string().min(1).max(500),
    amount: z.number().positive(),
    currency: z.string().length(3).default('EUR'),
    category: z.enum(['food', 'transport', 'accommodation', 'activity', 'shopping', 'other']),
    paid_by: z.string().uuid().optional(),
    split: z.boolean().default(true),
    date: z.string().optional(),
    day_id: z.string().uuid().optional(),
    notes: z.string().max(1000).optional(),
});

const FilterSchema = z.object({
    category: z.enum(['food', 'transport', 'accommodation', 'activity', 'shopping', 'other']).optional(),
    paid_by: z.string().uuid().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    day_id: z.string().uuid().optional(),
});

/** GET /api/trips/:id/expenses — list with filters, totals, and split */
tripsExpensesRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const url = new URL(c.req.url);
        const filter = FilterSchema.safeParse({
            category: url.searchParams.get('category') ?? undefined,
            paid_by: url.searchParams.get('paid_by') ?? undefined,
            from_date: url.searchParams.get('from_date') ?? undefined,
            to_date: url.searchParams.get('to_date') ?? undefined,
            day_id: url.searchParams.get('day_id') ?? undefined,
        });

        let query = supabase
            .from('expenses')
            .select('*')
            .eq('trip_id', id)
            .order('date', { ascending: true })
            .order('created_at', { ascending: false });

        if (filter.success) {
            if (filter.data.category) query = query.eq('category', filter.data.category);
            if (filter.data.paid_by) query = query.eq('paid_by', filter.data.paid_by);
            if (filter.data.from_date) query = query.gte('date', filter.data.from_date);
            if (filter.data.to_date) query = query.lte('date', filter.data.to_date);
            if (filter.data.day_id) query = query.eq('day_id', filter.data.day_id);
        }

        const { data: expenses, error } = await query;
        if (error) throw new Error(`[motonui][expenses][GET] ${error.message}`);

        const { data: members } = await supabase
            .from('trip_members')
            .select('user_id')
            .eq('trip_id', id);

        const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
        const summary = await getTripExpenseSummary(id);
        const split = splitExpenses(expenses as Expense[], memberIds);

        return ok(c, { expenses, summary, split });
    }, 'trips/:id/expenses GET')
);

/** POST /api/trips/:id/expenses — create expense with EUR conversion */
tripsExpensesRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
        const parsed = CreateExpenseSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const input = parsed.data;
        const payerId = input.paid_by ?? user.id;
        await requireDayInTrip(supabase, id, input.day_id);
        await requireTripPayer(supabase, id, payerId);

        const amount_eur = await convertCurrency(input.amount, input.currency, 'EUR');

        const { data: expense, error } = await supabase
            .from('expenses')
            .insert({
                ...input,
                description: sanitizePlainText(input.description, 500),
                notes: input.notes ? sanitizePlainText(input.notes, 1000) : null,
                currency: input.currency.toUpperCase(),
                trip_id: id,
                amount_eur,
                paid_by: payerId,
            })
            .select()
            .single();

        if (error) throw new Error(`[motonui][expenses][POST] ${error.message}`);

        return created(c, expense);
    }, 'trips/:id/expenses POST')
);

/** DELETE /api/trips/:id/expenses/:expenseId (no requireTripMember, ported as-is) */
tripsExpensesRouter.delete(
    '/:expenseId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const expenseId = requireParam(c, 'expenseId');

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expenseId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][expenses][DELETE] ${error.message}`);

        return ok(c, { success: true });
    }, 'trips/:id/expenses/:expenseId DELETE')
);
