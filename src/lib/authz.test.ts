import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { queryChain, type QueryResult } from '@/test/supabase-mock';
import { requireDayInTrip, requireLegInTrip, requireTripMember, requireTripPayer, type SupabaseLike } from './authz';

/** Client whose tables answer in order: e.g. { trip_members: [{ data: null }], trips: [...] }. */
function client(results: Record<string, QueryResult[]>) {
    const from = vi.fn((table: string) => queryChain(results[table]?.shift() ?? { data: null, error: null }));
    // Structural stand-in: only the chain methods authz uses are implemented.
    return { from } as unknown as SupabaseLike & { from: typeof from };
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const fail = (message: string): QueryResult => ({ data: null, error: { message } });

describe('requireTripMember', () => {
    it('allows a member without further queries', async () => {
        const supabase = client({ trip_members: [ok({ trip_id: 't' })] });
        await expect(requireTripMember(supabase, 't', 'u')).resolves.toBeUndefined();
        expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('allows the owner even without a membership row', async () => {
        const supabase = client({ trip_members: [ok(null)], trips: [ok({ owner_id: 'u' })] });
        await expect(requireTripMember(supabase, 't', 'u')).resolves.toBeUndefined();
    });

    it('rejects anyone else with 403', async () => {
        for (const trip of [null, { owner_id: 'someone-else' }]) {
            const supabase = client({ trip_members: [ok(null)], trips: [ok(trip)] });
            await expect(requireTripMember(supabase, 't', 'u')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
        }
    });

    it('fails closed on database errors', async () => {
        await expect(requireTripMember(client({ trip_members: [fail('down')] }), 't', 'u')).rejects.toThrow('down');
        await expect(requireTripMember(client({ trip_members: [ok(null)], trips: [fail('down')] }), 't', 'u')).rejects.toThrow('down');
    });
});

describe('nested resources', () => {
    it.each([
        ['day', requireDayInTrip],
        ['leg', requireLegInTrip],
    ] as const)('%s: skipped when absent, accepted inside the trip, 400 outside', async (_, check) => {
        const table = check === requireDayInTrip ? 'days' : 'legs';
        await expect(check(client({}), 't', null)).resolves.toBeUndefined();
        await expect(check(client({ [table]: [ok({ id: 'x' })] }), 't', 'x')).resolves.toBeUndefined();

        const error = await check(client({ [table]: [ok(null)] }), 't', 'x').catch((e: unknown) => e);
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ status: 400 });

        await expect(check(client({ [table]: [fail('down')] }), 't', 'x')).rejects.toThrow('down');
    });

    it('payer must be a member of the trip', async () => {
        await expect(requireTripPayer(client({ trip_members: [ok({ user_id: 'p' })] }), 't', 'p')).resolves.toBeUndefined();
        await expect(requireTripPayer(client({ trip_members: [ok(null)] }), 't', 'p')).rejects.toMatchObject({ status: 400 });
        await expect(requireTripPayer(client({ trip_members: [fail('down')] }), 't', 'p')).rejects.toThrow('down');
    });
});
