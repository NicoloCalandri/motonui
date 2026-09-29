import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eurCents, getTripExpenseSummary, splitExpenses, summarizeExpenses } from './expenses';
import { queryChain } from '@/test/supabase-mock';
import type { Expense } from './types';

const USER_A = 'user-a';
const USER_B = 'user-b';
const MEMBERS = [USER_A, USER_B];

const makeExpense = (overrides: Partial<Expense>): Expense => ({
    id: 'exp-1',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    trip_id: 'trip-1',
    day_id: null,
    description: 'Test expense',
    amount: 100,
    currency: 'EUR',
    amount_eur: 100,
    category: 'food',
    paid_by: USER_A,
    split: true,
    date: '2024-01-01',
    notes: null,
    ...overrides,
});

// =============================================================================
// eurCents
// =============================================================================

describe('eurCents', () => {
    it('uses amount_eur, then the amount for EUR, and null for a foreign currency without rate', () => {
        expect(eurCents({ amount: 100, currency: 'USD', amount_eur: 92.35 })).toBe(9235);
        expect(eurCents({ amount: 12.3, currency: 'eur', amount_eur: null })).toBe(1230);
        expect(eurCents({ amount: 100, currency: 'USD', amount_eur: null })).toBeNull();
    });

    it('does not drift on float amounts', () => {
        expect(eurCents({ amount: 0.29, currency: 'EUR', amount_eur: null })).toBe(29);
        expect(eurCents({ amount: 1.005, currency: 'EUR', amount_eur: 1.1 })).toBe(110);
    });
});

// =============================================================================
// splitExpenses
// =============================================================================

describe('splitExpenses', () => {
    it('does not report "even" while the partner has not joined (T-2.8)', () => {
        const result = splitExpenses([makeExpense({ paid_by: USER_A, amount: 80, amount_eur: 80 })], [USER_A]);

        expect(result).toEqual({ settlements: [], is_even: false, awaiting_partner: true, excluded_unconverted: 0 });
    });

    it('should return even split when expenses balance out', () => {
        const expenses = [
            makeExpense({ paid_by: USER_A, amount: 50, amount_eur: 50 }),
            makeExpense({ paid_by: USER_B, amount: 50, amount_eur: 50 }),
        ];
        const result = splitExpenses(expenses, MEMBERS);
        expect(result.is_even).toBe(true);
        expect(result.settlements).toHaveLength(0);
    });

    it('should calculate that user B owes user A when A paid more', () => {
        const result = splitExpenses([makeExpense({ paid_by: USER_A, amount: 100, amount_eur: 100 })], MEMBERS);
        expect(result.is_even).toBe(false);
        expect(result.settlements).toEqual([{ from_user_id: USER_B, to_user_id: USER_A, amount_eur: 50 }]);
    });

    it('should calculate that user A owes user B when B paid more', () => {
        const result = splitExpenses([makeExpense({ paid_by: USER_B, amount: 30, amount_eur: 30 })], MEMBERS);
        expect(result.settlements).toEqual([{ from_user_id: USER_A, to_user_id: USER_B, amount_eur: 15 }]);
    });

    it('should not include non-split expenses in settlement calculation', () => {
        const result = splitExpenses([makeExpense({ paid_by: USER_A, split: false })], MEMBERS);
        expect(result.is_even).toBe(true);
        expect(result.settlements).toHaveLength(0);
    });

    it('should handle zero expenses', () => {
        const result = splitExpenses([], MEMBERS);
        expect(result.is_even).toBe(true);
        expect(result.settlements).toHaveLength(0);
    });

    it('should handle mixed split/non-split expenses', () => {
        const expenses = [
            makeExpense({ paid_by: USER_A, amount: 200, amount_eur: 200, split: true }),
            makeExpense({ paid_by: USER_B, amount: 50, amount_eur: 50, split: false }),
        ];
        const result = splitExpenses(expenses, MEMBERS);
        expect(result.settlements[0]).toEqual({ from_user_id: USER_B, to_user_id: USER_A, amount_eur: 100 });
    });

    it('should use amount_eur when available', () => {
        const result = splitExpenses([makeExpense({ paid_by: USER_A, amount: 100, currency: 'USD', amount_eur: 92 })], MEMBERS);
        expect(result.settlements[0]?.amount_eur).toBe(46);
    });

    it('works in cents: many small amounts add up exactly', () => {
        // 10 × 0.10 € paid by A: B owes exactly 0.50 €, no 0.49999… drift.
        const expenses = Array.from({ length: 10 }, (_, i) => makeExpense({ id: `e${i}`, amount: 0.1, amount_eur: 0.1 }));
        expect(splitExpenses(expenses, MEMBERS).settlements[0]?.amount_eur).toBe(0.5);
    });

    it('keeps the odd cent with the payer', () => {
        const result = splitExpenses([makeExpense({ amount: 0.01, amount_eur: 0.01 })], MEMBERS);
        expect(result.is_even).toBe(true);
        expect(splitExpenses([makeExpense({ amount: 10.01, amount_eur: 10.01 })], MEMBERS).settlements[0]?.amount_eur).toBe(5);
    });

    it('leaves expenses without a rate out of the balance and reports them (T-3.2)', () => {
        const expenses = [
            makeExpense({ id: 'a', paid_by: USER_A, amount: 40, amount_eur: 40 }),
            makeExpense({ id: 'b', paid_by: USER_B, amount: 5000, currency: 'JPY', amount_eur: null }),
            makeExpense({ id: 'c', paid_by: USER_B, amount: 10, currency: 'USD', amount_eur: null, split: false }),
        ];

        const result = splitExpenses(expenses, MEMBERS);

        // Only the 40 € counts: without the fix, 5000 JPY would have been 5000 €.
        expect(result.settlements).toEqual([{ from_user_id: USER_B, to_user_id: USER_A, amount_eur: 20 }]);
        expect(result.excluded_unconverted).toBe(1);
    });

    it('considers only the two trip members (the DB allows no third, migration 0021)', () => {
        const result = splitExpenses([makeExpense({ paid_by: 'someone-else', amount: 90, amount_eur: 90 })], MEMBERS);
        expect(result.is_even).toBe(true);
    });
});

// =============================================================================
// summarizeExpenses / getTripExpenseSummary
// =============================================================================

describe('summarizeExpenses', () => {
    it('totals by category, payer, day and currency with mixed currencies', () => {
        const summary = summarizeExpenses([
            makeExpense({ id: '1', amount: 12.1, amount_eur: 12.1, category: 'food', date: '2024-01-01' }),
            makeExpense({ id: '2', amount: 20, currency: 'USD', amount_eur: 18.45, category: 'transport', paid_by: USER_B, date: '2024-01-01' }),
            makeExpense({ id: '3', amount: 0.2, amount_eur: null, category: 'food', date: '2024-01-02' }),
        ]);

        expect(summary.total_eur).toBe(30.75);
        expect(summary.by_category).toMatchObject({ food: 12.3, transport: 18.45, other: 0 });
        expect(summary.by_user).toEqual({ [USER_A]: 12.3, [USER_B]: 18.45 });
        expect(summary.by_day).toEqual({ '2024-01-01': 30.55, '2024-01-02': 0.2 });
        expect(summary.currency_breakdown).toEqual({ EUR: 12.3, USD: 20 });
        expect(summary.unconverted).toEqual({ count: 0, by_currency: {} });
    });

    it('reports foreign expenses without a rate instead of counting them as EUR', () => {
        const summary = summarizeExpenses([
            makeExpense({ id: '1', amount: 10, amount_eur: 10 }),
            makeExpense({ id: '2', amount: 100, currency: 'usd', amount_eur: null }),
            makeExpense({ id: '3', amount: 50, currency: 'USD', amount_eur: null }),
        ]);

        expect(summary.total_eur).toBe(10);
        expect(summary.unconverted).toEqual({ count: 2, by_currency: { USD: 150 } });
        expect(summary.currency_breakdown).toEqual({ EUR: 10, USD: 150 });
    });
});

describe('getTripExpenseSummary', () => {
    it('reads the trip expenses with the injected client (no module mock)', async () => {
        const chain = queryChain({ data: [makeExpense({ amount: 7.5, amount_eur: 7.5 })], error: null });
        const supabase = { from: () => chain } as unknown as SupabaseClient;

        const summary = await getTripExpenseSummary('trip-1', { supabase });

        expect(chain.calls).toContainEqual(['eq', ['trip_id', 'trip-1']]);
        expect(summary.total_eur).toBe(7.5);
    });

    it('surfaces database errors', async () => {
        const supabase = { from: () => queryChain({ data: null, error: { message: 'boom' } }) } as unknown as SupabaseClient;
        await expect(getTripExpenseSummary('trip-1', { supabase })).rejects.toThrow('boom');
    });
});
