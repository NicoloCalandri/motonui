import { describe, expect, it } from 'vitest';
import type { Activity, Restaurant, TripWithDetails } from '@/lib/types';
import { buildCalendarEvents } from './calendar-events';

const trip = {
    id: 't-1',
    days: [
        {
            id: 'd-1',
            legs: [
                { id: 'l-1', type: 'flight', from_name: 'Roma, Italia', to_name: 'Santiago, Cile', departure_at: '2026-10-01T10:00:00Z', carrier: 'LATAM' },
                { id: 'l-2', type: 'train', from_name: 'A', to_name: 'B', departure_at: '2026-10-02T10:00:00Z' },
            ],
            accommodations: [
                { id: 'a-1', name: 'Hotel Hanga Roa', check_in: '2026-10-03', check_out: '2026-10-06', payment_deadline: '2026-09-20', cancellation_deadline: null },
            ],
        },
    ],
} as unknown as TripWithDetails;

describe('buildCalendarEvents', () => {
    it('lists flights, stays, deadlines and dated bookings', () => {
        const events = buildCalendarEvents(
            trip,
            [{ id: 'r-1', name: 'Te Moana', date: '2026-10-04', time: '20:00' } as Restaurant, { id: 'r-2', name: 'Senza data', date: null } as Restaurant],
            [{ id: 'x-1', name: 'Rano Raraku', date: '2026-10-05', time: null } as Activity],
        );
        const ids = events.map((e) => e.id);

        expect(ids).toContain('flight-dep-l-1');
        expect(ids.some((id) => id.includes('l-2'))).toBe(false);
        expect(ids).toContain('pay-a-1');
        expect(ids).not.toContain('cancel-a-1');
        expect(ids).toContain('rest-r-1');
        expect(ids).not.toContain('rest-r-2');
        expect(events.find((e) => e.id === 'flight-dep-l-1')).toMatchObject({ title: 'Roma → Santiago', subtitle: 'LATAM', type: 'flight' });
        expect(events.find((e) => e.id === 'rest-r-1')?.subtitle).toBe('Ore 20:00');
        expect(events.find((e) => e.id === 'act-x-1')?.subtitle).toBeUndefined();
    });
});
