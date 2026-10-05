import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok, created } from '@/lib/errors';
import { getTripExpenseSummary, convertCurrency, splitExpenses } from '@/lib/expenses';
import { requireDayInTrip, requireTripPayer } from '@/lib/authz';
import { sanitizePlainText } from '@/lib/sanitize';
import type { Expense } from '@/lib/types';

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

/** GET /api/trips/[id]/expenses — list with filters, totals, and split */
export const GET = withRoute(
    { name: 'trips/[id]/expenses GET', params: tripParams(), query: FilterSchema, tripMember: true },
    async ({ supabase, params, query: filter }) => {
    const { id } = params;

    let query = supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', id)
        .order('date', { ascending: true })
        .order('created_at', { ascending: false });

    if (filter.category) query = query.eq('category', filter.category);
    if (filter.paid_by) query = query.eq('paid_by', filter.paid_by);
    if (filter.from_date) query = query.gte('date', filter.from_date);
    if (filter.to_date) query = query.lte('date', filter.to_date);
    if (filter.day_id) query = query.eq('day_id', filter.day_id);

    const { data: expenses, error } = await query;
    if (error) throw new Error(`[motonui][expenses][GET] ${error.message}`);

    // Get trip members for split calculation
    const { data: members } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', id);

    const memberIds = (members ?? []).map((m) => m.user_id);
    const summary = await getTripExpenseSummary(id, { supabase });
    const split = splitExpenses(expenses as Expense[], memberIds);

    return ok({ expenses, summary, split });
});

/** POST /api/trips/[id]/expenses — create expense with EUR conversion */
export const POST = withRoute(
    { name: 'trips/[id]/expenses POST', params: tripParams(), body: CreateExpenseSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id } = params;
    const input = body;
    const payerId = input.paid_by ?? user.id;
    await requireDayInTrip(supabase, id, input.day_id);
    await requireTripPayer(supabase, id, payerId);

    // Convert to EUR for unified reporting
    const amount_eur = await convertCurrency(input.amount, input.currency, 'EUR', { supabase });

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

    return created(expense);
});
