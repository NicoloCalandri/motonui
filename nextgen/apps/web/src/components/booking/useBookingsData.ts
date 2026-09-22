import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Leg, Accommodation, Restaurant, Activity } from '@motonui/shared-types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api-client';

function toTimestamp(value: string | null | undefined): number {
    if (!value) return Number.POSITIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function mergeDateTime(date: string | null | undefined, time: string | null | undefined): string | null {
    if (!date) return null;
    return `${date}T${time ?? '00:00'}:00`;
}

function compareLegByDate(a: Leg, b: Leg): number {
    const aTs = toTimestamp(a.departure_at ?? a.arrival_at);
    const bTs = toTimestamp(b.departure_at ?? b.arrival_at);
    if (aTs !== bTs) return aTs - bTs;
    return a.from_name.localeCompare(b.from_name);
}

function compareAccommodationByDate(a: Accommodation, b: Accommodation): number {
    const aTs = toTimestamp(a.check_in ?? a.check_out);
    const bTs = toTimestamp(b.check_in ?? b.check_out);
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
}

function compareRestaurantByDate(a: Restaurant, b: Restaurant): number {
    const aTs = toTimestamp(mergeDateTime(a.date, a.time));
    const bTs = toTimestamp(mergeDateTime(b.date, b.time));
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
}

function compareActivityByDate(a: Activity, b: Activity): number {
    const aTs = toTimestamp(mergeDateTime(a.date, a.time));
    const bTs = toTimestamp(mergeDateTime(b.date, b.time));
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
}

/**
 * Fetch/sort/delete logic for BookingsTab.tsx's four booking-entity
 * collections (legs, accommodations, restaurants, activities). Extracted
 * out of BookingsTab.tsx into its own hook — mirroring the
 * `useLegDrawerForm.ts` extraction pattern used to bring LegDrawer.tsx under
 * docs/CLAUDE.md's 300-line-per-file rule — to keep BookingsTab.tsx itself
 * (JSX shell + drawer-open state) under the limit. Not a 1:1 port of a
 * single old file/block: it's the same logic that lived inline in the old
 * `src/components/booking/BookingsTab.tsx` (592 lines, never split),
 * relocated rather than rewritten.
 *
 * See BookingsTab.tsx's doc comment for the touchpoint changes shared by
 * this hook's fetch/delete handlers (raw `fetch` -> `apiFetch(..., token)`,
 * disclosed `try`/`catch` safety addition around calls that had none).
 */
export function useBookingsData(
    tripId: string,
    initialRestaurants: Restaurant[],
    initialActivities: Activity[],
    onDataChange?: () => void
) {
    const { session } = useAuth();
    const token = session?.access_token;

    const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants);
    const [activities, setActivities] = useState<Activity[]>(initialActivities);
    const [legs, setLegs] = useState<Leg[]>([]);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);

    const sortedLegs = useMemo(() => [...legs].sort(compareLegByDate), [legs]);
    const sortedAccommodations = useMemo(() => [...accommodations].sort(compareAccommodationByDate), [accommodations]);
    const sortedRestaurants = useMemo(() => [...restaurants].sort(compareRestaurantByDate), [restaurants]);
    const sortedActivities = useMemo(() => [...activities].sort(compareActivityByDate), [activities]);

    const flights = useMemo(() => sortedLegs.filter((l) => l.type === 'flight'), [sortedLegs]);
    const transports = useMemo(() => sortedLegs.filter((l) => l.type !== 'flight'), [sortedLegs]);

    const fetchRestaurants = useCallback(async () => {
        try {
            setRestaurants(await apiFetch<Restaurant[]>(`/api/trips/${tripId}/restaurants`, {}, token));
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to fetch restaurants', err);
        }
    }, [tripId, token]);

    const fetchActivities = useCallback(async () => {
        try {
            setActivities(await apiFetch<Activity[]>(`/api/trips/${tripId}/activities`, {}, token));
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to fetch activities', err);
        }
    }, [tripId, token]);

    const fetchLegs = useCallback(async () => {
        try {
            setLegs(await apiFetch<Leg[]>(`/api/trips/${tripId}/legs`, {}, token));
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to fetch legs', err);
        }
    }, [tripId, token]);

    const fetchAccommodations = useCallback(async () => {
        try {
            setAccommodations(await apiFetch<Accommodation[]>(`/api/trips/${tripId}/accommodations`, {}, token));
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to fetch accommodations', err);
        }
    }, [tripId, token]);

    const deleteRestaurant = useCallback(async (id: string) => {
        if (!confirm('Eliminare questa prenotazione?')) return;
        try {
            await apiFetch(`/api/trips/${tripId}/restaurants/${id}`, { method: 'DELETE' }, token);
            await fetchRestaurants();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to delete restaurant', err);
        }
    }, [tripId, token, fetchRestaurants, onDataChange]);

    const deleteActivity = useCallback(async (id: string) => {
        if (!confirm('Eliminare questa attività?')) return;
        try {
            await apiFetch(`/api/trips/${tripId}/activities/${id}`, { method: 'DELETE' }, token);
            await fetchActivities();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to delete activity', err);
        }
    }, [tripId, token, fetchActivities, onDataChange]);

    const deleteLeg = useCallback(async (id: string, dayId: string | null) => {
        if (!confirm('Eliminare questo spostamento?')) return;
        const url = dayId ? `/api/trips/${tripId}/days/${dayId}/legs/${id}` : `/api/trips/${tripId}/legs/${id}`;
        try {
            await apiFetch(url, { method: 'DELETE' }, token);
            await fetchLegs();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to delete leg', err);
        }
    }, [tripId, token, fetchLegs, onDataChange]);

    const deleteAcc = useCallback(async (id: string, dayId: string | null) => {
        if (!confirm('Eliminare questo alloggio?')) return;
        const url = dayId ? `/api/trips/${tripId}/days/${dayId}/accommodations/${id}` : `/api/trips/${tripId}/accommodations/${id}`;
        try {
            await apiFetch(url, { method: 'DELETE' }, token);
            await fetchAccommodations();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][BookingsTab] failed to delete accommodation', err);
        }
    }, [tripId, token, fetchAccommodations, onDataChange]);

    useEffect(() => {
        fetchRestaurants();
        fetchActivities();
        fetchLegs();
        fetchAccommodations();
    }, [fetchRestaurants, fetchActivities, fetchLegs, fetchAccommodations]);

    return {
        flights, transports, sortedAccommodations, sortedRestaurants, sortedActivities,
        fetchRestaurants, fetchActivities, fetchLegs, fetchAccommodations,
        deleteRestaurant, deleteActivity, deleteLeg, deleteAcc,
    };
}
