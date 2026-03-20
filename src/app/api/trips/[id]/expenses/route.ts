import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';
import { getTripExpenseSummary, convertCurrency, splitExpenses } from '@/lib/expenses';
import { requireTripMember, requireDayInTrip, requireTripPayer } from '@/lib/authz';
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

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/expenses — list with filters, totals, and split */
export const GET = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;
    await requireTripMember(supabase, id, user.id);
    const { searchParams } = new URL(request.url);

    const filter = FilterSchema.safeParse({
        category: searchParams.get('category') ?? undefined,
        paid_by: searchParams.get('paid_by') ?? undefined,
        from_date: searchParams.get('from_date') ?? undefined,
        to_date: searchParams.get('to_date') ?? undefined,
        day_id: searchParams.get('day_id') ?? undefined,
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

    // Get trip members for split calculation
    const { data: members } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', id);

    const memberIds = (members ?? []).map((m) => m.user_id);
    const summary = await getTripExpenseSummary(id);
    const split = splitExpenses(expenses as Expense[], memberIds);

    return ok({ expenses, summary, split });
}, 'trips/[id]/expenses GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/expenses — create expense with EUR conversion */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;
    await requireTripMember(supabase, id, user.id);
    const body: unknown = await request.json();
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const input = parsed.data;
    const payerId = input.paid_by ?? user.id;
    await requireDayInTrip(supabase, id, input.day_id);
    await requireTripPayer(supabase, id, payerId);

    // Convert to EUR for unified reporting
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

    return created(expense);
}, 'trips/[id]/expenses POST') as (req: Request, ctx: Params) => Promise<Response>;
