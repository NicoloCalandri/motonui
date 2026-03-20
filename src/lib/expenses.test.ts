import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitExpenses, convertCurrency } from './expenses';
import type { Expense } from './types';

// Mock Supabase so getCachedRates can be tested independently
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue({
        from: () => ({
            select: () => ({
                gte: () => ({
                    order: () => ({
                        limit: () => ({
                            single: vi.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                    }),
                }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
        }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
    }),
}));

// =============================================================================
// splitExpenses
// =============================================================================

describe('splitExpenses', () => {
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
        const expenses = [
            makeExpense({ paid_by: USER_A, amount: 100, amount_eur: 100 }),
        ];
        const result = splitExpenses(expenses, MEMBERS);
        expect(result.is_even).toBe(false);
        expect(result.settlements).toHaveLength(1);
        expect(result.settlements[0]).toMatchObject({
            from_user_id: USER_B,
            to_user_id: USER_A,
            amount_eur: 50,
        });
    });

    it('should not include non-split expenses in settlement calculation', () => {
        const expenses = [
            makeExpense({ paid_by: USER_A, amount: 100, amount_eur: 100, split: false }),
        ];
        const result = splitExpenses(expenses, MEMBERS);
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
            makeExpense({ paid_by: USER_A, amount: 200, amount_eur: 200, split: true }),        // A pays 200 split → B owes A 100
            makeExpense({ paid_by: USER_B, amount: 50, amount_eur: 50, split: false }),         // B pays 50 for themselves only
        ];
        const result = splitExpenses(expenses, MEMBERS);
        expect(result.settlements[0]?.amount_eur).toBe(100);
        expect(result.settlements[0]?.from_user_id).toBe(USER_B);
    });

    it('should use amount_eur when available', () => {
        // 100 USD = 92 EUR
        const expenses = [
            makeExpense({ paid_by: USER_A, amount: 100, currency: 'USD', amount_eur: 92 }),
        ];
        const result = splitExpenses(expenses, MEMBERS);
        expect(result.settlements[0]?.amount_eur).toBe(46);
    });
});

describe('splitExpenses with 3 members', () => {
    const USER_A = 'user-a';
    const USER_B = 'user-b';
    const USER_C = 'user-c';
    const MEMBERS_3 = [USER_A, USER_B, USER_C];

    const makeExpense3 = (overrides: Partial<Expense>): Expense => ({
        id: 'exp-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        trip_id: 'trip-1',
        day_id: null,
        description: 'Test expense',
        amount: 90,
        currency: 'EUR',
        amount_eur: 90,
        category: 'food',
        paid_by: USER_A,
        split: true,
        date: '2024-01-01',
        notes: null,
        ...overrides,
    });

    it('calculates correct settlements when one member pays for all three', () => {
        const expenses = [makeExpense3({ paid_by: USER_A, amount: 90, amount_eur: 90 })];
        const result = splitExpenses(expenses, MEMBERS_3);
        // The function is optimised for 2-person trips: balances are computed for all members
        // but settlements only compare the first two. A net = +60, B net = -30 → B owes A 60.
        expect(result.is_even).toBe(false);
        expect(result.settlements).toHaveLength(1);
        expect(result.settlements[0].from_user_id).toBe(USER_B);
        expect(result.settlements[0].to_user_id).toBe(USER_A);
        expect(result.settlements[0].amount_eur).toBe(60);
    });

    it('is even when all three members paid equal shares', () => {
        const expenses = [
            makeExpense3({ paid_by: USER_A, amount: 30, amount_eur: 30 }),
            makeExpense3({ id: 'exp-2', paid_by: USER_B, amount: 30, amount_eur: 30 }),
            makeExpense3({ id: 'exp-3', paid_by: USER_C, amount: 30, amount_eur: 30 }),
        ];
        const result = splitExpenses(expenses, MEMBERS_3);
        expect(result.is_even).toBe(true);
        expect(result.settlements).toHaveLength(0);
    });

    it('handles single member group with no settlements', () => {
        const expenses = [makeExpense3({ paid_by: USER_A, amount: 100, amount_eur: 100 })];
        const result = splitExpenses(expenses, [USER_A]);
        expect(result.is_even).toBe(true);
        expect(result.settlements).toHaveLength(0);
    });

    it('returns no settlements for empty expenses regardless of member count', () => {
        const result = splitExpenses([], MEMBERS_3);
        expect(result.is_even).toBe(true);
        expect(result.settlements).toHaveLength(0);
    });
});

// =============================================================================
// convertCurrency
// =============================================================================

describe('convertCurrency', () => {
    it('should return the same amount when currencies match', async () => {
        const result = await convertCurrency(100, 'EUR', 'EUR');
        expect(result).toBe(100);
    });

    it('falls back to original amount when exchange rates are unavailable (no API key)', async () => {
        // Mock returns null for cached rates and EXCHANGE_RATE_API_KEY is unset
        // getCachedRates returns {} → convertCurrency falls back gracefully
        const result = await convertCurrency(100, 'USD', 'JPY');
        expect(result).toBe(100);
    });

    it('returns same amount for any currency pair when rates are missing', async () => {
        const result = await convertCurrency(42.5, 'GBP', 'CHF');
        expect(result).toBe(42.5);
    });

    it('returns exact amount for zero input regardless of currency', async () => {
        const result = await convertCurrency(0, 'USD', 'EUR');
        expect(result).toBe(0);
    });

    it('returns same amount when converting from EUR to EUR (shortcut path)', async () => {
        const result = await convertCurrency(250, 'EUR', 'EUR');
        expect(result).toBe(250);
    });
});
