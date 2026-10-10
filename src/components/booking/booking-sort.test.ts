import { describe, expect, it } from 'vitest';
import type { Leg, Restaurant } from '@/lib/types';
import { compareLegByDate, compareRestaurantByDate } from './booking-sort';

describe('booking sort', () => {
    it('orders legs by departure, undated last, then by origin', () => {
        const legs = [
            { from_name: 'Z', departure_at: null, arrival_at: null },
            { from_name: 'B', departure_at: '2026-10-02T08:00:00Z', arrival_at: null },
            { from_name: 'A', departure_at: '2026-10-02T08:00:00Z', arrival_at: null },
            { from_name: 'C', departure_at: null, arrival_at: '2026-10-01T08:00:00Z' },
        ] as Leg[];
        expect([...legs].sort(compareLegByDate).map((l) => l.from_name)).toEqual(['C', 'A', 'B', 'Z']);
    });

    it('orders restaurants by date and time', () => {
        const rs = [
            { name: 'Cena', date: '2026-10-01', time: '20:00' },
            { name: 'Pranzo', date: '2026-10-01', time: '12:30' },
            { name: 'Senza ora', date: '2026-10-01', time: null },
        ] as Restaurant[];
        expect([...rs].sort(compareRestaurantByDate).map((r) => r.name)).toEqual(['Senza ora', 'Pranzo', 'Cena']);
    });
});
