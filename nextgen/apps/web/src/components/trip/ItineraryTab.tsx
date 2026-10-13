import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import type { Leg, Accommodation, Activity, TripWithDetails } from '@motonui/shared-types';
import DayDrawer from './DayDrawer';
import LegDrawer from './LegDrawer';
import AccommodationDrawer from './AccommodationDrawer';
import BoardingPassViewer from './BoardingPassViewer';
import ItineraryLegCard from './ItineraryLegCard';
import ItineraryAccommodationCard from './ItineraryAccommodationCard';
import ItineraryActivityCard from './ItineraryActivityCard';
import ActivityDrawer from '../booking/ActivityDrawer';
import { useItineraryDays, type DayWithDetails } from './useItineraryDays';
import { calendarDate } from '../../lib/calendar-date';

interface ItineraryTabProps {
    trip: TripWithDetails;
    onDataChange?: () => void;
}

/**
 * Itinerary tab: timeline view of days, legs (spostamenti), and
 * accommodations (alloggi), with add/edit/delete drawers for each. Ported
 * from src/components/trip/ItineraryTab.tsx (491 lines).
 *
 * Split into five files for docs/CLAUDE.md's 300-line rule (old file wasn't
 * split): this file (shell, drawer wiring), `useItineraryDays.ts`
 * (fetch/delete logic, mirroring the `useLegDrawerForm.ts`/
 * `useBookingsData.ts` hook-extraction pattern), and `ItineraryLegCard.tsx`
 * + `ItineraryAccommodationCard.tsx` + `ItineraryActivityCard.tsx` (per-item
 * collapsed/expanded card markup, extracted verbatim, state lifted to props).
 *
 * Touchpoint changes:
 * - No `'use client'`. Types from `@motonui/shared-types`; `trip` prop is
 *   the full `TripWithDetails` (matches OverviewTab) instead of the old
 *   component's narrower ad-hoc shape.
 * - Raw `fetch(...)` (days refetch + the four deletes, now in
 *   `useItineraryDays.ts`) -> `apiFetch(..., token)`, matching
 *   DayDrawer/LegDrawer/AccommodationDrawer. None of
 *   `fetchDays`/`deleteDay`/`deleteLeg`/`deleteAcc`/`deleteActivity` has a
 *   loading/disabled UI state (the old component had none either), so
 *   there's no "stuck button" risk here — but the old delete handlers had NO
 *   error handling at all (a bare `await fetch(...)`), and `apiFetch` throws
 *   on non-2xx (unlike bare `fetch`), so unhandled-rejection risk went up. A
 *   `try`/`catch` (console.error, no alert — old app had no error UI for
 *   these) was added around each as a disclosed safety deviation.
 * - `deleteDay`/`deleteLeg`/`deleteAcc`/`deleteActivity` drop the old
 *   `tripId` param (already in scope via `trip.id`).
 *
 * Follow-up resolved in Task 4.9.3: Task 4.9.2 omitted the old component's
 * "Activities" section (`day.activities`, "Aggiungi Attività" ->
 * `ActivityDrawer`) entirely, disclosed as a scope gap, because
 * `ActivityDrawer` didn't exist yet (it's scoped to Task 4.9.3's Bookings
 * tab). Now that `ActivityDrawer` exists at
 * `nextgen/apps/web/src/components/booking/ActivityDrawer.tsx`, this file
 * wires the Activities section back in to match the old component's
 * behavior exactly: view (via `ItineraryActivityCard`), add/edit (via
 * `ActivityDrawer`, `dayContext` scoping new activities to the day), and
 * delete (`deleteActivity`, top-level `DELETE /api/trips/:id/activities/:id`
 * — activities have no day-nested delete route, same as the old component).
 * `GET /api/trips/:id/days` already returned `activities` unchanged, so no
 * API shape change was needed.
 */
export default function ItineraryTab({ trip, onDataChange }: ItineraryTabProps) {
    const { days, fetchDays, deleteDay, deleteLeg, deleteAcc, deleteActivity } =
        useItineraryDays(trip.id, trip.days ?? [], onDataChange);

    const [drawerOpen, setDrawerOpen] = useState(false);

    // Drawers state for items
    const [activeDay, setActiveDay] = useState<DayWithDetails | null>(null);
    const [legDrawerOpen, setLegDrawerOpen] = useState(false);
    const [accDrawerOpen, setAccDrawerOpen] = useState(false);
    const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
    const [editingLeg, setEditingLeg] = useState<Leg | null>(null);
    const [editingAcc, setEditingAcc] = useState<Accommodation | null>(null);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [boardingPassLeg, setBoardingPassLeg] = useState<Leg | null>(null);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedItemId((prev) => (prev === id ? null : id));
    };

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

            {/* Header / Add Button */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-900">Itinerario</h2>
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white hover:bg-black rounded-xl text-sm font-medium transition-colors shadow-panel"
                >
                    <PlusCircle className="w-4 h-4" /> Aggiungi giorno
                </button>
            </div>

            {days.length === 0 ? (
                <div className="p-6 text-center text-ink-400">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-sand-300" />
                    <p className="font-display text-lg font-semibold text-ink-700 mb-1">Nessun giorno pianificato</p>
                    <p className="text-sm">Aggiungi giorni per costruire il vostro itinerario</p>
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="mt-6 px-4 py-2 bg-neutral-900 text-white font-bold rounded-2xl shadow-panel hover:bg-black"
                    >
                        Inizia l&apos;itinerario
                    </button>
                </div>
            ) : (
                days.map((day, idx) => (
                    <div key={day.id} className="relative">
                        {/* Timeline connector */}
                        {idx < days.length - 1 && (
                            <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-sand-200 -z-10" />
                        )}

                        {/* Day header */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-terracotta-400 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {idx + 1}
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                                <div>
                                    <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
                                        {day.title ?? format(calendarDate(day.date), 'EEEE', { locale: it })}
                                    </h3>
                                    <p className="text-xs text-ink-400">
                                        {format(calendarDate(day.date), 'd MMMM yyyy', { locale: it })}
                                    </p>
                                </div>
                                <div className="flex gap-1 ml-auto">
                                    <button
                                        aria-label="Modifica giorno"
                                        onClick={() => { setActiveDay(day); setDrawerOpen(true); }}
                                        className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        aria-label="Elimina giorno"
                                        onClick={() => deleteDay(day.id)}
                                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="ml-11 space-y-2">
                            {/* Legs */}
                            {day.legs?.map((leg) => (
                                <ItineraryLegCard
                                    key={leg.id}
                                    leg={leg}
                                    expanded={expandedItemId === leg.id}
                                    onToggleExpand={() => toggleExpand(leg.id)}
                                    onShowBoardingPass={() => setBoardingPassLeg(leg)}
                                    onEdit={() => { setActiveDay(day); setEditingLeg(leg); setLegDrawerOpen(true); }}
                                    onDelete={() => deleteLeg(day.id, leg.id)}
                                />
                            ))}

                            {/* Accommodations */}
                            {day.accommodations?.map((acc) => (
                                <ItineraryAccommodationCard
                                    key={acc.id}
                                    acc={acc}
                                    expanded={expandedItemId === acc.id}
                                    onToggleExpand={() => toggleExpand(acc.id)}
                                    onEdit={() => { setActiveDay(day); setEditingAcc(acc); setAccDrawerOpen(true); }}
                                    onDelete={() => deleteAcc(day.id, acc.id)}
                                />
                            ))}

                            {/* Activities */}
                            {day.activities?.map((activity) => (
                                <ItineraryActivityCard
                                    key={activity.id}
                                    activity={activity}
                                    expanded={expandedItemId === activity.id}
                                    onToggleExpand={() => toggleExpand(activity.id)}
                                    onEdit={() => { setActiveDay(day); setEditingActivity(activity); setActivityDrawerOpen(true); }}
                                    onDelete={() => deleteActivity(activity.id)}
                                />
                            ))}

                            {day.legs?.length === 0 && day.accommodations?.length === 0 && day.activities?.length === 0 && (
                                <p className="text-xs text-ink-300 italic mb-2">Nessuna attività pianificata</p>
                            )}

                            {/* Add action buttons */}
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={() => { setActiveDay(day); setEditingLeg(null); setLegDrawerOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-colors"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" /> Spostamento
                                </button>
                                <button
                                    onClick={() => { setActiveDay(day); setEditingAcc(null); setAccDrawerOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-colors"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" /> Alloggio
                                </button>
                                <button
                                    onClick={() => { setActiveDay(day); setEditingActivity(null); setActivityDrawerOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-colors"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" /> Attività
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}

            <DayDrawer
                tripId={trip.id}
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setActiveDay(null); }}
                onSaved={() => { fetchDays(); onDataChange?.(); }}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
                initialData={activeDay ? { id: activeDay.id, date: activeDay.date, title: activeDay.title } : undefined}
            />

            <LegDrawer
                tripId={trip.id}
                dayId={activeDay?.id}
                dayDate={activeDay?.date}
                open={legDrawerOpen}
                onClose={() => { setLegDrawerOpen(false); setActiveDay(null); setEditingLeg(null); }}
                onSaved={() => { fetchDays(); onDataChange?.(); }}
                initialData={editingLeg ?? undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />

            <AccommodationDrawer
                tripId={trip.id}
                dayId={activeDay?.id}
                dayDate={activeDay?.date}
                open={accDrawerOpen}
                onClose={() => { setAccDrawerOpen(false); setActiveDay(null); setEditingAcc(null); }}
                onSaved={() => { fetchDays(); onDataChange?.(); }}
                initialData={editingAcc ?? undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />

            <ActivityDrawer
                tripId={trip.id}
                open={activityDrawerOpen}
                onClose={() => { setActivityDrawerOpen(false); setActiveDay(null); setEditingActivity(null); }}
                onSaved={() => { fetchDays(); onDataChange?.(); }}
                initialData={editingActivity ?? undefined}
                dayContext={activeDay ? { id: activeDay.id, date: activeDay.date } : undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />

            {boardingPassLeg && (
                <BoardingPassViewer
                    leg={boardingPassLeg}
                    onClose={() => setBoardingPassLeg(null)}
                />
            )}
        </div>
    );
}

// Custom calendar glyph — kept as a verbatim port of the old component's
// inline SVG (a plain `Calendar` import from lucide-react wasn't used in
// the old file either) rather than substituted for lucide's `Calendar`.
function CalendarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
    );
}
