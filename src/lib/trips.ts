import { createClient } from '@/lib/supabase/server';
import type { TripStats, LegType, Leg } from '@/lib/types';

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

/**
 * Computes aggregated stats for a trip:
 * - Total days
 * - Total km traveled (Haversine straight-line between legs)
 * - Countries visited (parsed from leg location names, heuristic)
 * - Total spent in EUR
 * - Average spend per day
 * - Transport type breakdown (km per leg type)
 *
 * @param tripId - The trip UUID
 */
export async function getTripStats(tripId: string): Promise<TripStats> {
    const supabase = await createClient();

    // Fetch trip, legs, and expenses in parallel
    const [tripResult, legsResult, expensesResult] = await Promise.all([
        supabase.from('trips').select('start_date, end_date, budget_eur').eq('id', tripId).single(),
        supabase.from('legs').select('*').eq('trip_id', tripId),
        supabase.from('expenses')
            .select('amount_eur, amount')
            .eq('trip_id', tripId),
    ]);

    if (tripResult.error) {
        throw new Error(`[motonui][trips][stats] trip query: ${tripResult.error.message}`);
    }

    const trip = tripResult.data;
    const legs = (legsResult.data ?? []) as Leg[];

    // Total days
    let totalDays = 0;
    if (trip.start_date && trip.end_date) {
        const start = new Date(trip.start_date);
        const end = new Date(trip.end_date);
        totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // km per leg type + countries visited
    const transportBreakdown = {} as Record<LegType, number>;
    let totalKm = 0;
    const countriesSet = new Set<string>();

    for (const leg of legs) {
        const hasCoords =
            leg.from_lat !== null &&
            leg.from_lng !== null &&
            leg.to_lat !== null &&
            leg.to_lng !== null;

        if (hasCoords) {
            const km = haversineDistanceKm(
                leg.from_lat!,
                leg.from_lng!,
                leg.to_lat!,
                leg.to_lng!
            );

            transportBreakdown[leg.type] = (transportBreakdown[leg.type] ?? 0) + km;
            totalKm += km;
        }

        // Heuristic: extract country from location name
        // Expects format "City, Country" or "Airport Name (XXX), Country"
        const extractCountry = (name: string) => {
            const parts = name.split(',');
            return parts[parts.length - 1]?.trim();
        };

        const fromCountry = extractCountry(leg.from_name);
        const toCountry = extractCountry(leg.to_name);
        if (fromCountry) countriesSet.add(fromCountry);
        if (toCountry) countriesSet.add(toCountry);
    }

    // Total spent in EUR
    const totalSpentEur = (expensesResult.data ?? []).reduce((sum: number, exp) => {
        return sum + (exp.amount_eur ?? exp.amount);
    }, 0);

    const avgPerDayEur = totalDays > 0 ? totalSpentEur / totalDays : 0;

    return {
        total_days: totalDays,
        total_km_traveled: Math.round(totalKm * 10) / 10,
        countries_visited: Array.from(countriesSet),
        total_spent_eur: Math.round(totalSpentEur * 100) / 100,
        avg_per_day_eur: Math.round(avgPerDayEur * 100) / 100,
        transport_breakdown: transportBreakdown,
        budget_eur: trip.budget_eur != null ? Number(trip.budget_eur) : null,
    };
}
