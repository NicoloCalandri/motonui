import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryChain } from '@/test/supabase-mock';
import {
    upsertAccommodationReminders,
    upsertActivityReminder,
    upsertFlightCheckinReminder,
    upsertReminder,
} from './reminders';

const NOW = new Date('2026-10-01T10:00:00Z');
const BASE = { userId: 'u1', tripId: 't1', now: NOW };

/** Injected fake client (T-3.4): records deletes and inserts on `reminders`. */
function fakeClient() {
    const deletes = queryChain({ data: null, error: null });
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ ...deletes, insert })) } as unknown as SupabaseClient;
    return { supabase, deletes, insert };
}

describe('reminders', () => {
    it('replaces the reminder of the same type for the entity', async () => {
        const { supabase, deletes, insert } = fakeClient();

        await upsertReminder(supabase, {
            ...BASE, entityType: 'leg', entityId: 'leg-1', type: 'flight_checkin',
            remindAt: new Date('2026-10-02T09:00:00Z'), title: 'Check-in',
        });

        expect(deletes.calls).toEqual([['delete', []], ['eq', ['entity_id', 'leg-1']], ['eq', ['type', 'flight_checkin']]]);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            trip_id: 't1', user_id: 'u1', remind_at: '2026-10-02T09:00:00.000Z', message: null,
        }));
    });

    it('only deletes when the reminder time is missing or already past for the injected clock', async () => {
        const { supabase, insert } = fakeClient();

        await upsertReminder(supabase, { ...BASE, entityType: 'leg', entityId: 'l', type: 'flight_checkin', remindAt: null, title: 'x' });
        await upsertReminder(supabase, {
            ...BASE, entityType: 'leg', entityId: 'l', type: 'flight_checkin', remindAt: new Date('2026-10-01T09:59:59Z'), title: 'x',
        });

        expect(insert).not.toHaveBeenCalled();
    });

    it('schedules the flight check-in one hour before it opens', async () => {
        const { supabase, insert } = fakeClient();

        await upsertFlightCheckinReminder(supabase, {
            ...BASE, legId: 'leg-1', checkinOpensAt: '2026-10-03T12:00:00Z',
            from: 'Roma, Italia', to: 'Santiago, Cile', carrier: 'LATAM',
        });

        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            remind_at: '2026-10-03T11:00:00.000Z', title: 'Check-in aperto: Roma → Santiago', message: 'LATAM',
        }));
    });

    it('schedules payment and cancellation reminders three days before each deadline', async () => {
        const { supabase, insert } = fakeClient();

        await upsertAccommodationReminders(supabase, {
            ...BASE, accId: 'acc-1', name: 'Hotel Hanga Roa',
            paymentDeadline: '2026-10-10T00:00:00Z', cancellationDeadline: null,
        });

        expect(insert).toHaveBeenCalledTimes(1);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ type: 'payment_deadline', remind_at: '2026-10-07T00:00:00.000Z' }));
    });

    it('schedules an activity three hours before it starts', async () => {
        const { supabase, insert } = fakeClient();

        await upsertActivityReminder(supabase, { ...BASE, activityId: 'a1', name: 'Rano Raraku', date: '2026-10-05', time: '14:30' });

        const inserted = (insert.mock.calls[0] as unknown as [{ remind_at: string }])[0];
        expect(new Date(inserted.remind_at).getTime()).toBe(new Date('2026-10-05T14:30:00').getTime() - 3 * 60 * 60 * 1000);
    });
});
