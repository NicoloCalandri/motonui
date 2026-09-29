'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/fetcher';
import type { Day, Leg, Accommodation, Activity } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import DayDrawer from './DayDrawer';
import LegDrawer from './LegDrawer';
import AccommodationDrawer from './AccommodationDrawer';
import BoardingPassViewer from './BoardingPassViewer';
import ActivityDrawer from '@/components/booking/ActivityDrawer';
import { AccommodationItem, ActivityItem, LegItem } from './itinerary-items';

type DayWithDetails = Day & { legs: Leg[]; accommodations: Accommodation[]; activities?: Activity[] };

interface ItineraryTabProps {
    trip: { id: string; days?: DayWithDetails[]; start_date?: string | null; end_date?: string | null };
    onDaysChange?: (days: DayWithDetails[]) => void;
    onDataChange?: () => void;
}

/**
 * Itinerary tab: timeline view of days, legs, accommodations.
 */
export default function ItineraryTab({ trip, onDaysChange, onDataChange }: ItineraryTabProps) {
    // Starts from the days embedded in the trip, then revalidates; each fetch
    // is pushed up so the other tabs see the same itinerary.
    const { data: days = [], mutate } = useSWR<DayWithDetails[]>(`/api/trips/${trip.id}/days`, jsonFetcher, {
        fallbackData: trip.days ?? [],
        onSuccess: (data) => onDaysChange?.(data),
    });
    const fetchDays = () => { void mutate(); };
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
        setExpandedItemId(prev => prev === id ? null : id);
    };

    const deleteDay = async (tripId: string, dayId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo giorno e tutte le sue attività?')) return;
        await fetch(`/api/trips/${tripId}/days/${dayId}`, { method: 'DELETE' });
        fetchDays();
        onDataChange?.();
    };

    const deleteLeg = async (tripId: string, dayId: string, legId: string) => {
        if (!confirm('Eliminare questo spostamento?')) return;
        await fetch(`/api/trips/${tripId}/days/${dayId}/legs/${legId}`, { method: 'DELETE' });
        fetchDays();
        onDataChange?.();
    };

    const deleteAcc = async (tripId: string, dayId: string, accId: string) => {
        if (!confirm('Eliminare questo alloggio?')) return;
        await fetch(`/api/trips/${tripId}/days/${dayId}/accommodations/${accId}`, { method: 'DELETE' });
        fetchDays();
        onDataChange?.();
    };

    const deleteActivity = async (tripId: string, activityId: string) => {
        if (!confirm('Eliminare questa attività?')) return;
        await fetch(`/api/trips/${tripId}/activities/${activityId}`, { method: 'DELETE' });
        fetchDays();
        onDataChange?.();
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
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-sand-300" />
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
                                    {day.title ?? format(new Date(day.date), 'EEEE', { locale: it })}
                                </h3>
                                <p className="text-xs text-ink-400">
                                    {format(new Date(day.date), 'd MMMM yyyy', { locale: it })}
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
                                    onClick={() => deleteDay(trip.id, day.id)}
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
                            <LegItem
                                key={leg.id}
                                leg={leg}
                                expanded={expandedItemId === leg.id}
                                onToggle={() => toggleExpand(leg.id)}
                                onViewBoardingPass={() => setBoardingPassLeg(leg)}
                                onEdit={() => { setActiveDay(day); setEditingLeg(leg); setLegDrawerOpen(true); }}
                                onDelete={() => deleteLeg(trip.id, day.id, leg.id)}
                            />
                        ))}

                        {/* Accommodations */}
                        {day.accommodations?.map((acc) => (
                            <AccommodationItem
                                key={acc.id}
                                accommodation={acc}
                                expanded={expandedItemId === acc.id}
                                onToggle={() => toggleExpand(acc.id)}
                                onEdit={() => { setActiveDay(day); setEditingAcc(acc); setAccDrawerOpen(true); }}
                                onDelete={() => deleteAcc(trip.id, day.id, acc.id)}
                            />
                        ))}

                        {/* Activities */}
                        {day.activities?.map((activity) => (
                            <ActivityItem
                                key={activity.id}
                                activity={activity}
                                expanded={expandedItemId === activity.id}
                                onToggle={() => toggleExpand(activity.id)}
                                onEdit={() => { setActiveDay(day); setEditingActivity(activity); setActivityDrawerOpen(true); }}
                                onDelete={() => deleteActivity(trip.id, activity.id)}
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

const Calendar = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
);
