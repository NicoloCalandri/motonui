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

// =============================================================================
// convertCurrency
// =============================================================================

describe('convertCurrency', () => {
    it('should return the same amount when currencies match', async () => {
        const result = await convertCurrency(100, 'EUR', 'EUR');
        expect(result).toBe(100);
    });
});
