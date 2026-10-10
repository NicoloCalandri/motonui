import type { SupabaseClient } from '@supabase/supabase-js';
import { eurCents } from '@/lib/expenses';
import { fromCents } from '@/lib/currency';
import type { Expense, TripStats, LegType, Leg } from '@/lib/types';

// =============================================================================
// HAVERSINE DISTANCE
// =============================================================================

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 *
 * @param lat1 - Latitude of point A in decimal degrees
 * @param lng1 - Longitude of point A in decimal degrees
 * @param lat2 - Latitude of point B in decimal degrees
 * @param lng2 - Longitude of point B in decimal degrees
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

// =============================================================================
// TRIP STATS
// =============================================================================

type TripDates = { start_date: string | null; end_date: string | null; budget_eur: number | string | null };
type ExpenseAmounts = Pick<Expense, 'amount' | 'amount_eur' | 'currency'>;

/** Last comma-separated part of "City, Country" / "Airport (XXX), Country". */
function extractCountry(name: string): string | undefined {
    const parts = name.split(',');
    return parts[parts.length - 1]?.trim() || undefined;
}

/**
 * Aggregated stats for a trip (pure): days, straight-line km per leg type,
 * countries (heuristic from location names), EUR spent and per-day average.
 * Expenses still to convert are left out of the EUR totals (T-3.2).
 */
export function computeTripStats(trip: TripDates, legs: Leg[], expenses: ExpenseAmounts[]): TripStats {
    let totalDays = 0;
    if (trip.start_date && trip.end_date) {
        const start = new Date(trip.start_date);
        const end = new Date(trip.end_date);
        totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const transportBreakdown = {} as Record<LegType, number>;
    let totalKm = 0;
    const countries = new Set<string>();

    for (const leg of legs) {
        if (leg.from_lat !== null && leg.from_lng !== null && leg.to_lat !== null && leg.to_lng !== null) {
            const km = haversineDistanceKm(leg.from_lat, leg.from_lng, leg.to_lat, leg.to_lng);
            transportBreakdown[leg.type] = (transportBreakdown[leg.type] ?? 0) + km;
            totalKm += km;
        }
        for (const name of [leg.from_name, leg.to_name]) {
            const country = extractCountry(name);
            if (country) countries.add(country);
        }
    }

    const spentCents = expenses.reduce((sum, expense) => sum + (eurCents(expense) ?? 0), 0);
    const unconverted = expenses.filter((expense) => eurCents(expense) === null).length;

    return {
        total_days: totalDays,
        total_km_traveled: Math.round(totalKm * 10) / 10,
        countries_visited: Array.from(countries),
        total_spent_eur: fromCents(spentCents),
        avg_per_day_eur: totalDays > 0 ? Math.round(spentCents / totalDays) / 100 : 0,
        transport_breakdown: transportBreakdown,
        budget_eur: trip.budget_eur != null ? Number(trip.budget_eur) : null,
        unconverted_expenses: unconverted,
    };
}

/** Loads trip, legs and expenses with the caller's client (RLS applies). */
export async function getTripStats(tripId: string, deps: { supabase: SupabaseClient }): Promise<TripStats> {
    const { supabase } = deps;
    const [tripResult, legsResult, expensesResult] = await Promise.all([
        supabase.from('trips').select('start_date, end_date, budget_eur').eq('id', tripId).single(),
        supabase.from('legs').select('*').eq('trip_id', tripId),
        supabase.from('expenses').select('amount_eur, amount, currency').eq('trip_id', tripId),
    ]);

    if (tripResult.error || !tripResult.data) {
        throw new Error(`[motonui][trips][stats] trip query: ${tripResult.error?.message ?? 'not found'}`);
    }

    return computeTripStats(
        tripResult.data as TripDates,
        (legsResult.data ?? []) as Leg[],
        (expensesResult.data ?? []) as ExpenseAmounts[],
    );
}
