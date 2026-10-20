import { useCallback, useEffect, useState } from 'react';
import type { Day, Leg, Accommodation, Activity } from '@motonui/shared-types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api-client';

export type DayWithDetails = Day & { legs: Leg[]; accommodations: Accommodation[]; activities?: Activity[] };

/**
 * Fetch/delete logic for ItineraryTab.tsx's day timeline (days, plus the
 * legs/accommodations/activities nested within them). Extracted out of
 * ItineraryTab.tsx into its own hook — mirroring the `useLegDrawerForm.ts`/
 * `useBookingsData.ts` hook-extraction pattern — to keep ItineraryTab.tsx
 * itself (JSX shell + drawer-open state) under docs/CLAUDE.md's
 * 300-line-per-file rule once the Activities section (Task 4.9.3 follow-up,
 * see ItineraryTab.tsx's doc comment) was wired back in. Not a 1:1 port of a
 * single old file/block: it's the same logic that lived inline in the old
 * `src/components/trip/ItineraryTab.tsx` (491 lines, never split),
 * relocated rather than rewritten — see ItineraryTab.tsx's doc comment for
 * the touchpoint changes shared by these handlers (raw `fetch` ->
 * `apiFetch(..., token)`, disclosed `try`/`catch` safety addition around
 * calls that had none).
 */
export function useItineraryDays(tripId: string, initialDays: DayWithDetails[], onDataChange?: () => void) {
    const { session } = useAuth();
    const token = session?.access_token;

    const [days, setDays] = useState<DayWithDetails[]>(initialDays);

    const fetchDays = useCallback(async () => {
        try {
            setDays(await apiFetch<DayWithDetails[]>(`/api/trips/${tripId}/days`, {}, token));
        } catch (err) {
            console.error('[motonui][ItineraryTab] failed to fetch days', err);
        }
    }, [tripId, token]);

    useEffect(() => {
        fetchDays();
    }, [fetchDays]);

    const deleteDay = useCallback(async (dayId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo giorno e tutte le sue attività?')) return;
        try {
            await apiFetch(`/api/trips/${tripId}/days/${dayId}`, { method: 'DELETE' }, token);
            await fetchDays();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][ItineraryTab] failed to delete day', err);
        }
    }, [tripId, token, fetchDays, onDataChange]);

    const deleteLeg = useCallback(async (dayId: string, legId: string) => {
        if (!confirm('Eliminare questo spostamento?')) return;
        try {
            await apiFetch(`/api/trips/${tripId}/days/${dayId}/legs/${legId}`, { method: 'DELETE' }, token);
            await fetchDays();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][ItineraryTab] failed to delete leg', err);
        }
    }, [tripId, token, fetchDays, onDataChange]);

    const deleteAcc = useCallback(async (dayId: string, accId: string) => {
        if (!confirm('Eliminare questo alloggio?')) return;
        try {
            await apiFetch(`/api/trips/${tripId}/days/${dayId}/accommodations/${accId}`, { method: 'DELETE' }, token);
            await fetchDays();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][ItineraryTab] failed to delete accommodation', err);
        }
    }, [tripId, token, fetchDays, onDataChange]);

    const deleteActivity = useCallback(async (activityId: string) => {
        if (!confirm('Eliminare questa attività?')) return;
        try {
            await apiFetch(`/api/trips/${tripId}/activities/${activityId}`, { method: 'DELETE' }, token);
            await fetchDays();
            onDataChange?.();
        } catch (err) {
            console.error('[motonui][ItineraryTab] failed to delete activity', err);
        }
    }, [tripId, token, fetchDays, onDataChange]);

    return { days, fetchDays, deleteDay, deleteLeg, deleteAcc, deleteActivity };
}
