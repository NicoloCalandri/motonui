import { createClient } from '@/lib/supabase/server';
import type { Expense, ExpenseCategory, ExpenseSummary, SplitResult, Settlement } from '@/lib/types';

const BASE_CURRENCY = 'EUR';

// =============================================================================
// CURRENCY CONVERSION
// =============================================================================

/**
 * Returns a cached record of exchange rates (base: EUR).
 * Fetches from exchangerate-api.com if cache is older than 24 hours.
 */
async function getCachedRates(): Promise<Record<string, number>> {
    const supabase = await createClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: cached } = await supabase.from('currency_rates')
        .select('rates, fetched_at')
        .gte('fetched_at', oneDayAgo)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();

    if (cached) {
        return cached.rates as Record<string, number>;
    }

    // Cache miss — fetch fresh rates
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
        console.warn('[motonui][expenses][currency] EXCHANGE_RATE_API_KEY not set — rates unavailable');
        return {};
    }

    const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${BASE_CURRENCY}`
    );

    if (!response.ok) {
        throw new Error(`[motonui][expenses][currency] Exchange rate API error: ${response.status}`);
    }

    const json = (await response.json()) as { conversion_rates: Record<string, number> };
    const rates = json.conversion_rates;

    // Store in Supabase (upsert by truncating old rows first — simple approach for personal app)
    await supabase.from('currency_rates').insert({
        base_currency: BASE_CURRENCY,
        rates,
        fetched_at: new Date().toISOString(),
    });

    return rates;
}

/**
 * Converts an amount from one currency to another using cached exchange rates.
 * Falls back to 1:1 if rates are unavailable.
 *
 * @param amount - The amount to convert
 * @param from - Source currency code (e.g., "USD")
 * @param to - Target currency code (e.g., "EUR")
 */
export async function convertCurrency(
    amount: number,
    from: string,
    to: string
): Promise<number> {
    if (from === to) return amount;

    try {
        const rates = await getCachedRates();

        // rates are all relative to EUR base
        // to convert: amount_EUR = amount / rates[from], then amount_to = amount_EUR * rates[to]
        const fromRate = rates[from];
        const toRate = rates[to];

        if (!fromRate || !toRate) {
            console.warn(`[motonui][expenses][currency] Missing rate for ${from} or ${to}`);
            return amount;
        }

        const amountInEur = amount / fromRate;
        return Math.round(amountInEur * toRate * 100) / 100;
    } catch (error) {
        console.error('[motonui][expenses][currency] Conversion failed:', error);
        return amount; // graceful fallback
    }
}

// =============================================================================
// EXPENSE SUMMARY
// =============================================================================

/**
 * Computes a full expense summary for a trip including totals by category,
 * user, day, and original currency.
 *
 * @param tripId - The trip UUID
 */
export async function getTripExpenseSummary(tripId: string): Promise<ExpenseSummary> {
    const supabase = await createClient();

    const { data: expenses, error } = await supabase.from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true });

    if (error) {
        throw new Error(`[motonui][expenses][summary] ${error.message}`);
    }

    const rows = (expenses ?? []) as Expense[];

    const summary: ExpenseSummary = {
        total_eur: 0,
        by_category: {
            food: 0,
            transport: 0,
            accommodation: 0,
            activity: 0,
            shopping: 0,
            other: 0,
        },
        by_user: {},
        by_day: {},
        currency_breakdown: {},
    };

    for (const expense of rows) {
        const eurAmount = expense.amount_eur ?? expense.amount;

        summary.total_eur += eurAmount;
        summary.by_category[expense.category] = (summary.by_category[expense.category] ?? 0) + eurAmount;
        summary.by_user[expense.paid_by] = (summary.by_user[expense.paid_by] ?? 0) + eurAmount;

        if (expense.date) {
            summary.by_day[expense.date] = (summary.by_day[expense.date] ?? 0) + eurAmount;
        }

        summary.currency_breakdown[expense.currency] =
            (summary.currency_breakdown[expense.currency] ?? 0) + expense.amount;
    }

    // Round all values to 2 decimal places
    summary.total_eur = Math.round(summary.total_eur * 100) / 100;

    for (const cat of Object.keys(summary.by_category) as ExpenseCategory[]) {
        summary.by_category[cat] = Math.round(summary.by_category[cat] * 100) / 100;
    }

    for (const userId of Object.keys(summary.by_user)) {
        summary.by_user[userId] = Math.round(summary.by_user[userId] * 100) / 100;
    }

    return summary;
}

// =============================================================================
// EXPENSE SPLIT
// =============================================================================

/**
 * Calculates who owes whom based on expense data.
 * Only expenses with `split = true` are included.
 * Uses the minimum number of transactions algorithm.
 *
 * @param expenses - Array of Expense objects for a trip
 * @param memberIds - Array of trip member user IDs (exactly 2 for motonui)
 */
export function splitExpenses(expenses: Expense[], memberIds: string[]): SplitResult {
    // Calculate each member's net balance (positive = owed money, negative = owes money)
    const balances: Record<string, number> = {};

    for (const memberId of memberIds) {
        balances[memberId] = 0;
    }

    for (const expense of expenses) {
        if (!expense.split) {
            // Non-split expenses: only the payer "uses" this money (no debt)
            continue;
        }

        const eurAmount = expense.amount_eur ?? expense.amount;
        const share = eurAmount / memberIds.length;

        // Payer gets credit for the full amount
        balances[expense.paid_by] = (balances[expense.paid_by] ?? 0) + eurAmount;

        // All members (including payer) consume their share
        for (const memberId of memberIds) {
            balances[memberId] = (balances[memberId] ?? 0) - share;
        }
    }

    // Simplify debts: find who owes whom
    const settlements: Settlement[] = [];

    // For a 2-person app, this is straightforward
    const [userA, userB] = memberIds;
    if (!userA || !userB) {
        return { settlements: [], is_even: true };
    }

    const netA = Math.round((balances[userA] ?? 0) * 100) / 100;

    if (Math.abs(netA) < 0.01) {
        return { settlements: [], is_even: true };
    }

    if (netA < 0) {
        // userA owes userB
        settlements.push({
            from_user_id: userA,
            to_user_id: userB,
            amount_eur: Math.abs(netA),
        });
    } else {
        // userB owes userA
        settlements.push({
            from_user_id: userB,
            to_user_id: userA,
            amount_eur: netA,
        });
    }

    return { settlements, is_even: false };
}
