'use client';

import { useEffect, useState } from 'react';
import type { Day, Leg, Accommodation, Activity } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plane, Train, Car, Ship, PersonStanding, Bus, MapPin, Hotel, PlusCircle, Pencil, Trash2, Ticket } from 'lucide-react';
import DayDrawer from './DayDrawer';
import LegDrawer from './LegDrawer';
import AccommodationDrawer from './AccommodationDrawer';
import BoardingPassViewer from './BoardingPassViewer';
import ActivityDrawer from '@/components/booking/ActivityDrawer';

const LEG_ICONS: Record<string, React.ElementType> = {
    flight: Plane, train: Train, car: Car, ferry: Ship, walk: PersonStanding, bus: Bus, other: MapPin,
};

const getLegBorderClass = (type: Leg['type']) => (type === 'flight' ? 'border-l-2 border-blue-300' : 'border-l-2 border-slate-300');

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
    const [days, setDays] = useState<DayWithDetails[]>(trip.days ?? []);
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

    const fetchDays = () => {
        fetch(`/api/trips/${trip.id}/days`)
            .then((r) => r.json())
            .then((data: DayWithDetails[]) => {
                setDays(data);
                onDaysChange?.(data);
            })
            .catch(() => { });
    };

    useEffect(() => {
        fetchDays();
    }, [trip.id]);

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
                        {day.legs?.map((leg) => {
                            const Icon = LEG_ICONS[leg.type] ?? MapPin;
                            return (
                                <div key={leg.id} className={`card overflow-hidden group ${getLegBorderClass(leg.type)}`}>
                                    <div 
                                        className="p-3 flex items-start gap-3 cursor-pointer hover:bg-ink-50/50 transition-colors"
                                        onClick={() => toggleExpand(leg.id)}
                                    >
                                        <div className="w-8 h-8 mt-0.5 bg-ink-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-4 h-4 text-ink-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-ink-800 truncate">
                                                {leg.from_name} → {leg.to_name}
                                            </p>
                                            {leg.carrier && (
                                                <p className="text-xs text-ink-500 truncate">{leg.carrier}</p>
                                            )}
                                            {leg.departure_at && (
                                                <p className="text-xs text-ink-400">
                                                    {format(new Date(leg.departure_at), 'HH:mm')}
                                                    {leg.arrival_at && ` → ${format(new Date(leg.arrival_at), 'HH:mm')}`}
                                                </p>
                                            )}
                                        </div>
                                        {leg.cost && (
                                            <span className="text-xs text-ink-500 whitespace-nowrap mt-1">
                                                {leg.currency} {leg.cost}
                                            </span>
                                        )}
                                        <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                            {leg.type === 'flight' && leg.boarding_pass_url && (
                                                <button
                                                    aria-label="Vedi carta d'imbarco"
                                                    onClick={(e) => { e.stopPropagation(); setBoardingPassLeg(leg); }}
                                                    className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                                                >
                                                    <Ticket className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                aria-label="Modifica spostamento"
                                                onClick={(e) => { e.stopPropagation(); setActiveDay(day); setEditingLeg(leg); setLegDrawerOpen(true); }}
                                                className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                aria-label="Elimina spostamento"
                                                onClick={(e) => { e.stopPropagation(); deleteLeg(trip.id, day.id, leg.id); }}
                                                className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {expandedItemId === leg.id && (
                                        <div className="px-12 pb-4 pt-1 text-sm text-ink-600 bg-ink-50/30 border-t border-ink-100 space-y-2">
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <div>
                                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Da</span>
                                                    <span className="font-medium">{leg.from_name}</span>
                                                    {leg.departure_at && <span className="block text-xs">{format(new Date(leg.departure_at), 'd MMM HH:mm', { locale: it })}</span>}
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">A</span>
                                                    <span className="font-medium">{leg.to_name}</span>
                                                    {leg.arrival_at && <span className="block text-xs">{format(new Date(leg.arrival_at), 'd MMM HH:mm', { locale: it })}</span>}
                                                </div>
                                            </div>
                                            
                                            {(leg.carrier || leg.booking_ref || leg.duration_min) && (
                                                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                                                    {leg.carrier && (
                                                        <div><span className="text-[10px] font-bold uppercase text-ink-400">Operatore:</span> <span className="font-medium">{leg.carrier}</span></div>
                                                    )}
                                                    {leg.booking_ref && (
                                                        <div><span className="text-[10px] font-bold uppercase text-ink-400">Ref:</span> <span className="font-medium">{leg.booking_ref}</span></div>
                                                    )}
                                                    {leg.duration_min && (
                                                        <div><span className="text-[10px] font-bold uppercase text-ink-400">Durata:</span> <span className="font-medium">{Math.floor(leg.duration_min / 60)}h {leg.duration_min % 60}m</span></div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {leg.notes && (
                                                <div className="pt-2 border-t border-ink-100 mt-2">
                                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Note</span>
                                                    <p className="whitespace-pre-wrap">{leg.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Accommodations */}
                        {day.accommodations?.map((acc) => (
                            <div key={acc.id} className="card overflow-hidden border-l-2 border-emerald-300 group">
                                <div 
                                    className="p-3 flex items-start gap-3 cursor-pointer hover:bg-sage-50/30 transition-colors"
                                    onClick={() => toggleExpand(acc.id)}
                                >
                                    <div className="w-8 h-8 mt-0.5 bg-sage-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Hotel className="w-4 h-4 text-sage-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-ink-800 truncate">{acc.name}</p>
                                        {acc.address && <p className="text-xs text-ink-400 truncate">{acc.address}</p>}
                                    </div>
                                    {acc.cost && (
                                        <span className="text-xs text-ink-500 whitespace-nowrap mt-1">
                                            {acc.currency} {acc.cost}
                                        </span>
                                    )}
                                    <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                        <button
                                            aria-label="Modifica alloggio"
                                            onClick={(e) => { e.stopPropagation(); setActiveDay(day); setEditingAcc(acc); setAccDrawerOpen(true); }}
                                            className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            aria-label="Elimina alloggio"
                                            onClick={(e) => { e.stopPropagation(); deleteAcc(trip.id, day.id, acc.id); }}
                                            className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                
                                {expandedItemId === acc.id && (
                                    <div className="px-12 pb-4 pt-1 text-sm text-ink-600 bg-sage-50/20 border-t border-sage-100 space-y-2">
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Check-in</span>
                                                <span className="font-medium">{acc.check_in ? format(new Date(acc.check_in), 'd MMM yyyy', { locale: it }) : '-'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Check-out</span>
                                                <span className="font-medium">{acc.check_out ? format(new Date(acc.check_out), 'd MMM yyyy', { locale: it }) : '-'}</span>
                                            </div>
                                        </div>
                                        
                                        {(acc.address || acc.booking_ref) && (
                                            <div className="flex flex-col gap-1 pt-2">
                                                {acc.address && (
                                                    <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Indirizzo:</span><span className="font-medium">{acc.address}</span></div>
                                                )}
                                                {acc.booking_ref && (
                                                    <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Ref Prenotazione:</span><span className="font-medium">{acc.booking_ref}</span></div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {acc.notes && (
                                            <div className="pt-2 border-t border-sage-100 mt-2">
                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Note</span>
                                                <p className="whitespace-pre-wrap">{acc.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Activities */}
                        {day.activities?.map((activity) => (
                            <div key={activity.id} className="card overflow-hidden border-l-2 border-violet-300 group">
                                <div
                                    className="p-3 flex items-start gap-3 cursor-pointer hover:bg-violet-50/30 transition-colors"
                                    onClick={() => toggleExpand(activity.id)}
                                >
                                    <div className="w-8 h-8 mt-0.5 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Ticket className="w-4 h-4 text-violet-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-ink-800 truncate">{activity.name}</p>
                                        <p className="text-xs text-ink-500 capitalize">{activity.type}</p>
                                        {(activity.date || activity.time) && (
                                            <p className="text-xs text-ink-400">
                                                {activity.date ? format(new Date(activity.date), 'd MMM', { locale: it }) : ''}
                                                {activity.time ? `${activity.date ? ' · ' : ''}${activity.time}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    {activity.cost && (
                                        <span className="text-xs text-ink-500 whitespace-nowrap mt-1">
                                            {activity.currency} {activity.cost}
                                        </span>
                                    )}
                                    <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                        <button
                                            aria-label="Modifica attività"
                                            onClick={(e) => { e.stopPropagation(); setActiveDay(day); setEditingActivity(activity); setActivityDrawerOpen(true); }}
                                            className="p-1.5 rounded-lg text-ink-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            aria-label="Elimina attività"
                                            onClick={(e) => { e.stopPropagation(); deleteActivity(trip.id, activity.id); }}
                                            className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {expandedItemId === activity.id && (
                                    <div className="px-12 pb-4 pt-1 text-sm text-ink-600 bg-violet-50/20 border-t border-violet-100 space-y-2">
                                        {(activity.address || activity.booking_ref || activity.duration_min) && (
                                            <div className="flex flex-col gap-1 pt-2">
                                                {activity.address && (
                                                    <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Luogo:</span><span className="font-medium">{activity.address}</span></div>
                                                )}
                                                {activity.booking_ref && (
                                                    <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Ref Prenotazione:</span><span className="font-medium">{activity.booking_ref}</span></div>
                                                )}
                                                {activity.duration_min && (
                                                    <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Durata:</span><span className="font-medium">{activity.duration_min} min</span></div>
                                                )}
                                            </div>
                                        )}

                                        {activity.notes && (
                                            <div className="pt-2 border-t border-violet-100 mt-2">
                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Note</span>
                                                <p className="whitespace-pre-wrap">{activity.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Calendar = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
);
