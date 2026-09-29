import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryChain } from '@/test/supabase-mock';
import { computeTripStats, getTripStats, haversineDistanceKm } from './trips';
import type { Leg } from './types';

function leg(overrides: Partial<Leg>): Leg {
    return {
        id: 'l', trip_id: 't', type: 'flight', from_name: 'Roma, Italia', to_name: 'Santiago, Cile',
        from_lat: 41.9028, from_lng: 12.4964, to_lat: -33.4489, to_lng: -70.6693, ...overrides,
    } as Leg;
}

describe('computeTripStats', () => {
    it('counts days, km per leg type and countries', () => {
        const stats = computeTripStats(
            { start_date: '2026-10-01', end_date: '2026-10-10', budget_eur: '3000' },
            [leg({}), leg({ id: 'l2', type: 'bus', from_name: 'Santiago, Cile', to_name: 'Valparaíso, Cile', from_lat: null })],
            [],
        );

        expect(stats.total_days).toBe(10);
        expect(stats.total_km_traveled).toBeGreaterThan(11000);
        expect(stats.transport_breakdown).toEqual({ flight: stats.total_km_traveled });
        expect(stats.countries_visited).toEqual(['Italia', 'Cile']);
        expect(stats.budget_eur).toBe(3000);
    });

    it('sums EUR in cents and leaves out expenses still to convert (T-3.2)', () => {
        const stats = computeTripStats(
            { start_date: '2026-10-01', end_date: '2026-10-03', budget_eur: null },
            [],
            [
                { amount: 0.1, amount_eur: 0.1, currency: 'EUR' },
                { amount: 0.2, amount_eur: null, currency: 'EUR' },
                { amount: 5000, amount_eur: null, currency: 'JPY' },
                { amount: 100, amount_eur: 92.59, currency: 'USD' },
            ],
        );

        expect(stats.total_spent_eur).toBe(92.89);
        expect(stats.avg_per_day_eur).toBe(30.96);
        expect(stats.unconverted_expenses).toBe(1);
        expect(stats.budget_eur).toBeNull();
    });

    it('has no days nor average without dates', () => {
        const stats = computeTripStats({ start_date: null, end_date: null, budget_eur: null }, [], [{ amount: 10, amount_eur: 10, currency: 'EUR' }]);
        expect(stats).toMatchObject({ total_days: 0, avg_per_day_eur: 0, total_spent_eur: 10 });
    });
});

describe('getTripStats', () => {
    it('loads the three tables with the injected client', async () => {
        const results: Record<string, ReturnType<typeof queryChain>> = {
            trips: queryChain({ data: { start_date: null, end_date: null, budget_eur: null }, error: null }),
            legs: queryChain({ data: [], error: null }),
            expenses: queryChain({ data: [{ amount: 4, amount_eur: 4, currency: 'EUR' }], error: null }),
        };
        const supabase = { from: (table: string) => results[table] } as unknown as SupabaseClient;

        expect((await getTripStats('t', { supabase })).total_spent_eur).toBe(4);
        expect(results.legs.calls).toContainEqual(['eq', ['trip_id', 't']]);
    });

    it('throws when the trip cannot be read', async () => {
        const supabase = { from: () => queryChain({ data: null, error: { message: 'denied' } }) } as unknown as SupabaseClient;
        await expect(getTripStats('t', { supabase })).rejects.toThrow('denied');
    });
});

describe('haversineDistanceKm', () => {
    it('should return 0 for identical coordinates', () => {
        const dist = haversineDistanceKm(41.9, 12.5, 41.9, 12.5);
        expect(dist).toBe(0);
    });

    it('should calculate Rome to Milan correctly (~480 km)', () => {
        // Rome: 41.9028°N, 12.4964°E
        // Milan: 45.4654°N, 9.1866°E
        const dist = haversineDistanceKm(41.9028, 12.4964, 45.4654, 9.1866);
        expect(dist).toBeGreaterThan(470);
        expect(dist).toBeLessThan(510);
    });

    it('should calculate Lisbon to Tokyo correctly (~10,000 km)', () => {
        const dist = haversineDistanceKm(38.7169, -9.1399, 35.6762, 139.6503);
        expect(dist).toBeGreaterThan(10000);
        expect(dist).toBeLessThan(11500);
    });

    it('should be symmetric (A→B = B→A)', () => {
        const distAB = haversineDistanceKm(48.8566, 2.3522, 35.6762, 139.6503);
        const distBA = haversineDistanceKm(35.6762, 139.6503, 48.8566, 2.3522);
        expect(distAB).toBe(distBA);
    });

    it('returns a positive value for any two different points', () => {
        // Two points 1 degree apart on the equator
        const dist = haversineDistanceKm(0, 0, 0, 1);
        expect(dist).toBeGreaterThan(0);
    });

    it('calculates equatorial distance correctly (~111 km per degree)', () => {
        const dist = haversineDistanceKm(0, 0, 0, 1);
        expect(dist).toBeGreaterThan(110);
        expect(dist).toBeLessThan(115);
    });

    it('calculates distance between cities in southern hemisphere', () => {
        // Sydney (-33.8688, 151.2093) to Melbourne (-37.8136, 144.9631) ≈ 714 km
        const dist = haversineDistanceKm(-33.8688, 151.2093, -37.8136, 144.9631);
        expect(dist).toBeGreaterThan(700);
        expect(dist).toBeLessThan(730);
    });

    it('calculates distance crossing the prime meridian (London to Paris)', () => {
        // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ≈ 340–342 km
        const dist = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
        expect(dist).toBeGreaterThan(335);
        expect(dist).toBeLessThan(360);
    });

    it('calculates distance crossing the antimeridian (negative to positive longitude)', () => {
        // Los Angeles (34.05, -118.24) to Tokyo (35.68, 139.69) ≈ 8700–9100 km
        const dist = haversineDistanceKm(34.05, -118.24, 35.68, 139.69);
        expect(dist).toBeGreaterThan(8700);
        expect(dist).toBeLessThan(9200);
    });

    it('result is rounded to 1 decimal place', () => {
        const dist = haversineDistanceKm(41.9028, 12.4964, 45.4654, 9.1866);
        const decimalPart = String(dist).split('.')[1];
        expect(decimalPart === undefined || decimalPart.length <= 1).toBe(true);
    });
});
