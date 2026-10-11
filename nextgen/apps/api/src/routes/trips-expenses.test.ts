import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * An expense in a currency with no exchange rate is saved "to be converted":
 * amount_eur stays null, it is never filled with the unconverted amount.
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';
const USER = { id: '00000000-0000-4000-8000-00000000000c', email: 'user@example.com' };

const state = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; payload: Record<string, unknown> }> }));
const currency = vi.hoisted(() => ({ convert: vi.fn() }));

function stubClient() {
    const builder = (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'update', 'upsert', 'delete', 'like']) chain[method] = () => chain;
        chain.insert = (payload: Record<string, unknown>) => {
            state.inserts.push({ table, payload });
            return chain;
        };
        const row = { id: 'x', trip_id: TRIP, user_id: USER.id, owner_id: USER.id, role: 'user', suspended_at: null };
        const one = async () => ({ data: row, error: null });
        chain.single = one;
        chain.maybeSingle = one;
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve);
        return chain;
    };
    return {
        auth: { getUser: async () => ({ data: { user: USER } }) },
        from: builder,
        rpc: async () => ({ data: [{ allowed: true, hits: 1, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null }),
    };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));
vi.mock('../lib/currency', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/currency')>()),
    convertCurrency: currency.convert,
}));

import { createApp } from '../app';

function createExpense(body: Record<string, unknown>) {
    return createApp().request(`/api/trips/${TRIP}/expenses`, {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/trips/:id/expenses', () => {
    beforeEach(() => {
        state.inserts = [];
        vi.clearAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('saves amount_eur as null when there is no rate for the currency', async () => {
        currency.convert.mockResolvedValue(null);

        const res = await createExpense({ description: 'Cena', amount: 25000, currency: 'CLP', category: 'food' });

        expect(res.status).toBe(201);
        const expense = state.inserts.find((insert) => insert.table === 'expenses');
        expect(expense?.payload).toMatchObject({ amount: 25000, currency: 'CLP', amount_eur: null });
    });

    it('saves the converted amount when there is a rate', async () => {
        currency.convert.mockResolvedValue(24.5);

        await createExpense({ description: 'Cena', amount: 25000, currency: 'CLP', category: 'food' });

        const expense = state.inserts.find((insert) => insert.table === 'expenses');
        expect(expense?.payload).toMatchObject({ amount_eur: 24.5 });
    });
});
