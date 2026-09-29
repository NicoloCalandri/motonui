import type { SupabaseClient } from '@supabase/supabase-js';
import { BASE_CURRENCY, fromCents, toCents } from '@/lib/currency';
import type { Expense, ExpenseCategory, ExpenseSummary, SplitResult, Settlement } from '@/lib/types';

/**
 * Expense business logic (T-3.2, FR-21–22). Pure functions over expense rows,
 * with arithmetic in integer cents so totals and balances never drift.
 *
 * An expense in a foreign currency without `amount_eur` (no rate when it was
 * saved) is "da convertire": it is left out of totals and balances and
 * reported separately, instead of being counted as if it were in EUR.
 */

export { convertCurrency } from '@/lib/currency';

const CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'];

/** EUR value in cents, or null when the expense still needs a rate. */
export function eurCents(expense: Pick<Expense, 'amount' | 'amount_eur' | 'currency'>): number | null {
    if (expense.amount_eur !== null && expense.amount_eur !== undefined) return toCents(Number(expense.amount_eur));
    if (expense.currency.toUpperCase() === BASE_CURRENCY) return toCents(Number(expense.amount));
    return null;
}

/** Totals by category, payer, day and original currency (pure). */
export function summarizeExpenses(rows: Expense[]): ExpenseSummary {
    let totalCents = 0;
    const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<ExpenseCategory, number>;
    const byUser: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const currencyCents: Record<string, number> = {};
    const unconvertedCents: Record<string, number> = {};
    let unconvertedCount = 0;

    for (const expense of rows) {
        const currency = expense.currency.toUpperCase();
        currencyCents[currency] = (currencyCents[currency] ?? 0) + toCents(Number(expense.amount));

        const cents = eurCents(expense);
        if (cents === null) {
            unconvertedCount += 1;
            unconvertedCents[currency] = (unconvertedCents[currency] ?? 0) + toCents(Number(expense.amount));
            continue;
        }

        totalCents += cents;
        byCategory[expense.category] = (byCategory[expense.category] ?? 0) + cents;
        byUser[expense.paid_by] = (byUser[expense.paid_by] ?? 0) + cents;
        if (expense.date) byDay[expense.date] = (byDay[expense.date] ?? 0) + cents;
    }

    const toUnits = (record: Record<string, number>) =>
        Object.fromEntries(Object.entries(record).map(([key, cents]) => [key, fromCents(cents)]));

    return {
        total_eur: fromCents(totalCents),
        by_category: toUnits(byCategory) as Record<ExpenseCategory, number>,
        by_user: toUnits(byUser),
        by_day: toUnits(byDay),
        currency_breakdown: toUnits(currencyCents),
        unconverted: { count: unconvertedCount, by_currency: toUnits(unconvertedCents) },
    };
}

/** Loads the trip's expenses with the caller's client (RLS applies) and summarizes them. */
export async function getTripExpenseSummary(tripId: string, deps: { supabase: SupabaseClient }): Promise<ExpenseSummary> {
    const { data, error } = await deps.supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][expenses][summary] ${error.message}`);
    return summarizeExpenses((data ?? []) as Expense[]);
}

/**
 * Who owes whom, for the two members of a trip. Only `split` expenses count;
 * expenses still to convert are excluded and reported in `excluded_unconverted`.
 */
export function splitExpenses(expenses: Expense[], memberIds: string[]): SplitResult {
    const [userA, userB] = memberIds;
    const excludedUnconverted = expenses.filter((expense) => expense.split && eurCents(expense) === null).length;

    if (!userA || !userB) {
        // T-2.8: a single member has no balance; "even" would be misleading.
        return { settlements: [], is_even: false, awaiting_partner: true, excluded_unconverted: excludedUnconverted };
    }

    // Net balance of A in cents: positive = A is owed money.
    let netA = 0;
    for (const expense of expenses) {
        if (!expense.split) continue;
        const cents = eurCents(expense);
        if (cents === null) continue;

        // Each member owes half; the odd cent stays with the payer.
        const otherShare = Math.floor(cents / 2);
        if (expense.paid_by === userA) netA += otherShare;
        else if (expense.paid_by === userB) netA -= otherShare;
    }

    if (netA === 0) {
        return { settlements: [], is_even: true, awaiting_partner: false, excluded_unconverted: excludedUnconverted };
    }

    const settlement: Settlement = netA < 0
        ? { from_user_id: userA, to_user_id: userB, amount_eur: fromCents(-netA) }
        : { from_user_id: userB, to_user_id: userA, amount_eur: fromCents(netA) };

    return { settlements: [settlement], is_even: false, awaiting_partner: false, excluded_unconverted: excludedUnconverted };
}
