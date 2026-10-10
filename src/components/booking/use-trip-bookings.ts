import useSWR from 'swr';
import { jsonFetcher } from '@/lib/fetcher';
import type { Accommodation, Activity, Leg, Restaurant, TripWithDetails } from '@/lib/types';

/**
 * Bookings of a trip, fetched with SWR (T-3.5). Legs and accommodations come
 * from the trip-level routes so the ones without a day are included too.
 */
export function useTripBookings(trip: TripWithDetails) {
    const base = `/api/trips/${trip.id}`;
    const restaurants = useSWR<Restaurant[]>(`${base}/restaurants`, jsonFetcher, { fallbackData: trip.restaurants ?? [] });
    const activities = useSWR<Activity[]>(`${base}/activities`, jsonFetcher, { fallbackData: trip.activities ?? [] });
    const legs = useSWR<Leg[]>(`${base}/legs`, jsonFetcher);
    const accommodations = useSWR<Accommodation[]>(`${base}/accommodations`, jsonFetcher);

    return {
        restaurants: restaurants.data ?? [],
        activities: activities.data ?? [],
        legs: legs.data ?? [],
        accommodations: accommodations.data ?? [],
        refreshRestaurants: () => { void restaurants.mutate(); },
        refreshActivities: () => { void activities.mutate(); },
        refreshLegs: () => { void legs.mutate(); },
        refreshAccommodations: () => { void accommodations.mutate(); },
    };
}
