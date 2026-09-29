'use client';

import { useMemo, useState } from 'react';
import { Plane, Hotel, Utensils, Ticket, Bus, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Leg, Accommodation, Restaurant, Activity, TripWithDetails } from '@/lib/types';
import { AccommodationCard, ActivityCard, EmptyState, FlightCard, RestaurantCard, TransportCard } from './booking-cards';
import { compareAccommodationByDate, compareActivityByDate, compareLegByDate, compareRestaurantByDate } from './booking-sort';
import { useTripBookings } from './use-trip-bookings';
import RestaurantDrawer from './RestaurantDrawer';
import ActivityDrawer from './ActivityDrawer';
import LegDrawer from '@/components/trip/LegDrawer';
import AccommodationDrawer from '@/components/trip/AccommodationDrawer';

type Section = 'flights' | 'hotels' | 'restaurants' | 'activities' | 'transports';

interface BookingsTabProps {
    trip: TripWithDetails;
    onDataChange?: () => void;
}

/**
 * Bookings hub tab: unified view of all trip reservations,
 * grouped by type (flights, hotels, restaurants, activities, transports).
 */
export default function BookingsTab({ trip, onDataChange }: BookingsTabProps) {
    const {
        restaurants, activities, legs, accommodations,
        refreshRestaurants: fetchRestaurants, refreshActivities: fetchActivities,
        refreshLegs: fetchLegs, refreshAccommodations: fetchAccommodations,
    } = useTripBookings(trip);
    const [expandedSections, setExpandedSections] = useState<Set<Section>>(new Set(['flights', 'hotels', 'restaurants', 'activities', 'transports']));

    // Drawer state
    const [restaurantDrawerOpen, setRestaurantDrawerOpen] = useState(false);
    const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
    const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [legDrawerOpen, setLegDrawerOpen] = useState(false);
    const [editingLeg, setEditingLeg] = useState<Leg | null>(null);
    const [accDrawerOpen, setAccDrawerOpen] = useState(false);
    const [editingAcc, setEditingAcc] = useState<Accommodation | null>(null);

    const sortedLegs = useMemo(() => [...legs].sort(compareLegByDate), [legs]);
    const sortedAccommodations = useMemo(() => [...accommodations].sort(compareAccommodationByDate), [accommodations]);
    const sortedRestaurants = useMemo(() => [...restaurants].sort(compareRestaurantByDate), [restaurants]);
    const sortedActivities = useMemo(() => [...activities].sort(compareActivityByDate), [activities]);

    const flights = sortedLegs.filter((l) => l.type === 'flight');
    const transports = sortedLegs.filter((l) => l.type !== 'flight');

    const toggleSection = (section: Section) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const deleteRestaurant = async (id: string) => {
        if (!confirm('Eliminare questa prenotazione?')) return;
        await fetch(`/api/trips/${trip.id}/restaurants/${id}`, { method: 'DELETE' });
        fetchRestaurants();
        onDataChange?.();
    };

    const deleteActivity = async (id: string) => {
        if (!confirm('Eliminare questa attività?')) return;
        await fetch(`/api/trips/${trip.id}/activities/${id}`, { method: 'DELETE' });
        fetchActivities();
        onDataChange?.();
    };

    const deleteLeg = async (id: string, dayId: string | null) => {
        if (!confirm('Eliminare questo spostamento?')) return;
        const url = dayId ? `/api/trips/${trip.id}/days/${dayId}/legs/${id}` : `/api/trips/${trip.id}/legs/${id}`;
        await fetch(url, { method: 'DELETE' });
        fetchLegs();
        onDataChange?.();
    };

    const deleteAcc = async (id: string, dayId: string | null) => {
        if (!confirm('Eliminare questo alloggio?')) return;
        const url = dayId ? `/api/trips/${trip.id}/days/${dayId}/accommodations/${id}` : `/api/trips/${trip.id}/accommodations/${id}`;
        await fetch(url, { method: 'DELETE' });
        fetchAccommodations();
        onDataChange?.();
    };

    const SECTIONS: { id: Section; label: string; icon: React.ElementType; count: number; color: string }[] = [
        { id: 'flights', label: 'Voli', icon: Plane, count: flights.length, color: 'bg-blue-500' },
        { id: 'hotels', label: 'Alloggi', icon: Hotel, count: sortedAccommodations.length, color: 'bg-emerald-500' },
        { id: 'restaurants', label: 'Ristoranti', icon: Utensils, count: sortedRestaurants.length, color: 'bg-orange-500' },
        { id: 'activities', label: 'Attività', icon: Ticket, count: sortedActivities.length, color: 'bg-purple-500' },
        { id: 'transports', label: 'Trasporti', icon: Bus, count: transports.length, color: 'bg-slate-500' },
    ];

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl font-semibold text-ink-900">Prenotazioni</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { setEditingLeg(null); setLegDrawerOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors"
                    >
                        <Plane className="w-3.5 h-3.5" /> Volo/Trasporto
                    </button>
                    <button
                        onClick={() => { setEditingAcc(null); setAccDrawerOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors"
                    >
                        <Hotel className="w-3.5 h-3.5" /> Alloggio
                    </button>
                    <button
                        onClick={() => { setEditingRestaurant(null); setRestaurantDrawerOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors"
                    >
                        <Utensils className="w-3.5 h-3.5" /> Ristorante
                    </button>
                    <button
                        onClick={() => { setEditingActivity(null); setActivityDrawerOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white rounded-xl text-xs font-bold hover:bg-purple-600 transition-colors"
                    >
                        <Ticket className="w-3.5 h-3.5" /> Attività
                    </button>
                </div>
            </div>

            {/* Summary pills */}
            <div className="flex flex-wrap gap-2">
                {SECTIONS.map(({ id, label, icon: Icon, count, color }) => (
                    <div key={id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-sand-200 shadow-sm">
                        <div className={`w-6 h-6 ${color} rounded-lg flex items-center justify-center`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-ink-700">{count}</span>
                        <span className="text-xs text-ink-400">{label}</span>
                    </div>
                ))}
            </div>

            {/* Sections */}
            {SECTIONS.map(({ id, label, icon: Icon, count, color }) => (
                <div key={id} className="card overflow-hidden">
                    <button
                        onClick={() => toggleSection(id)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-sand-50 transition-colors"
                    >
                        <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="font-display font-semibold text-ink-900">{label}</h3>
                            <p className="text-xs text-ink-400">
                                {count === 0 ? 'Nessuna prenotazione' : `${count} prenotazion${count === 1 ? 'e' : 'i'}`}
                            </p>
                        </div>
                        {expandedSections.has(id) ? (
                            <ChevronUp className="w-4 h-4 text-ink-300" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-ink-300" />
                        )}
                    </button>

                    {expandedSections.has(id) && (
                        <div className="border-t border-sand-100 divide-y divide-sand-100">
                            {id === 'flights' && flights.map(leg => (
                                <FlightCard key={leg.id} leg={leg} onEdit={() => { setEditingLeg(leg); setLegDrawerOpen(true); }} onDelete={() => deleteLeg(leg.id, leg.day_id)} />
                            ))}
                            {id === 'hotels' && sortedAccommodations.map(acc => (
                                <AccommodationCard key={acc.id} accommodation={acc} onEdit={() => { setEditingAcc(acc); setAccDrawerOpen(true); }} onDelete={() => deleteAcc(acc.id, acc.day_id)} />
                            ))}
                            {id === 'restaurants' && sortedRestaurants.map(rest => (
                                <RestaurantCard
                                    key={rest.id}
                                    restaurant={rest}
                                    onEdit={() => { setEditingRestaurant(rest); setRestaurantDrawerOpen(true); }}
                                    onDelete={() => deleteRestaurant(rest.id)}
                                />
                            ))}
                            {id === 'activities' && sortedActivities.map(act => (
                                <ActivityCard
                                    key={act.id}
                                    activity={act}
                                    onEdit={() => { setEditingActivity(act); setActivityDrawerOpen(true); }}
                                    onDelete={() => deleteActivity(act.id)}
                                />
                            ))}
                            {id === 'transports' && transports.map(leg => (
                                <TransportCard key={leg.id} leg={leg} onEdit={() => { setEditingLeg(leg); setLegDrawerOpen(true); }} onDelete={() => deleteLeg(leg.id, leg.day_id)} />
                            ))}

                            {/* Empty state */}
                            {id === 'flights' && flights.length === 0 && (
                                <EmptyState text="Nessun volo aggiunto">
                                    <button
                                        onClick={() => { setEditingLeg(null); setLegDrawerOpen(true); }}
                                        className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-600"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" /> Aggiungi volo
                                    </button>
                                </EmptyState>
                            )}
                            {id === 'hotels' && sortedAccommodations.length === 0 && (
                                <EmptyState text="Nessun alloggio aggiunto">
                                    <button
                                        onClick={() => { setEditingAcc(null); setAccDrawerOpen(true); }}
                                        className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-600"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" /> Aggiungi alloggio
                                    </button>
                                </EmptyState>
                            )}
                            {id === 'restaurants' && sortedRestaurants.length === 0 && (
                                <EmptyState text="Nessun ristorante aggiunto">
                                    <button
                                        onClick={() => { setEditingRestaurant(null); setRestaurantDrawerOpen(true); }}
                                        className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" /> Aggiungi ristorante
                                    </button>
                                </EmptyState>
                            )}
                            {id === 'activities' && sortedActivities.length === 0 && (
                                <EmptyState text="Nessuna attività aggiunta">
                                    <button
                                        onClick={() => { setEditingActivity(null); setActivityDrawerOpen(true); }}
                                        className="mt-2 flex items-center gap-1 text-xs font-bold text-purple-500 hover:text-purple-600"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" /> Aggiungi attività
                                    </button>
                                </EmptyState>
                            )}
                            {id === 'transports' && transports.length === 0 && (
                                <EmptyState text="Nessun trasporto aggiunto">
                                    <button
                                        onClick={() => { setEditingLeg(null); setLegDrawerOpen(true); }}
                                        className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-600"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5" /> Aggiungi trasporto
                                    </button>
                                </EmptyState>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Drawers */}
            <RestaurantDrawer
                tripId={trip.id}
                open={restaurantDrawerOpen}
                onClose={() => { setRestaurantDrawerOpen(false); setEditingRestaurant(null); }}
                onSaved={() => { fetchRestaurants(); onDataChange?.(); }}
                initialData={editingRestaurant ?? undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />
            <ActivityDrawer
                tripId={trip.id}
                open={activityDrawerOpen}
                onClose={() => { setActivityDrawerOpen(false); setEditingActivity(null); }}
                onSaved={() => { fetchActivities(); onDataChange?.(); }}
                initialData={editingActivity ?? undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />
            <LegDrawer
                tripId={trip.id}
                open={legDrawerOpen}
                onClose={() => { setLegDrawerOpen(false); setEditingLeg(null); }}
                onSaved={() => { fetchLegs(); onDataChange?.(); }}
                initialData={editingLeg ?? undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />
            <AccommodationDrawer
                tripId={trip.id}
                open={accDrawerOpen}
                onClose={() => { setAccDrawerOpen(false); setEditingAcc(null); }}
                onSaved={() => { fetchAccommodations(); onDataChange?.(); }}
                initialData={editingAcc ?? undefined}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
            />
        </div>
    );
}
