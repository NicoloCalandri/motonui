'use client';

import { useEffect, useState } from 'react';
import type { Day, Leg, Accommodation } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plane, Train, Car, Ship, PersonStanding, Bus, MapPin, Hotel, PlusCircle } from 'lucide-react';

const LEG_ICONS: Record<string, React.ElementType> = {
    flight: Plane, train: Train, car: Car, ferry: Ship, walk: PersonStanding, bus: Bus, other: MapPin,
};

type DayWithDetails = Day & { legs: Leg[]; accommodations: Accommodation[] };

interface ItineraryTabProps {
    trip: { id: string; days?: DayWithDetails[] };
}

/**
 * Itinerary tab: timeline view of days, legs, accommodations.
 */
export default function ItineraryTab({ trip }: ItineraryTabProps) {
    const [days, setDays] = useState<DayWithDetails[]>(trip.days ?? []);

    useEffect(() => {
        fetch(`/api/trips/${trip.id}/days`)
            .then((r) => r.json())
            .then((data: DayWithDetails[]) => setDays(data))
            .catch(() => { });
    }, [trip.id]);

    if (days.length === 0) {
        return (
            <div className="p-6 text-center text-ink-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-sand-300" />
                <p className="font-display text-lg font-semibold text-ink-700 mb-1">Nessun giorno pianificato</p>
                <p className="text-sm">Aggiungi giorni per costruire il vostro itinerario</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
            {days.map((day, idx) => (
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
                        <div>
                            <h3 className="font-display font-semibold text-ink-900">
                                {day.title ?? format(new Date(day.date), 'EEEE', { locale: it })}
                            </h3>
                            <p className="text-xs text-ink-400">
                                {format(new Date(day.date), 'd MMMM yyyy', { locale: it })}
                            </p>
                        </div>
                    </div>

                    <div className="ml-11 space-y-2">
                        {/* Legs */}
                        {day.legs?.map((leg) => {
                            const Icon = LEG_ICONS[leg.type] ?? MapPin;
                            return (
                                <div key={leg.id} className="card p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-ink-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-ink-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-ink-800 truncate">
                                            {leg.from_name} → {leg.to_name}
                                        </p>
                                        {leg.departure_at && (
                                            <p className="text-xs text-ink-400">
                                                {format(new Date(leg.departure_at), 'HH:mm')}
                                                {leg.arrival_at && ` → ${format(new Date(leg.arrival_at), 'HH:mm')}`}
                                            </p>
                                        )}
                                    </div>
                                    {leg.cost && (
                                        <span className="text-xs text-ink-500 whitespace-nowrap">
                                            {leg.currency} {leg.cost}
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Accommodations */}
                        {day.accommodations?.map((acc) => (
                            <div key={acc.id} className="card p-3 flex items-center gap-3 border-l-2 border-sage-300">
                                <div className="w-8 h-8 bg-sage-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Hotel className="w-4 h-4 text-sage-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-ink-800 truncate">{acc.name}</p>
                                    {acc.address && <p className="text-xs text-ink-400 truncate">{acc.address}</p>}
                                </div>
                            </div>
                        ))}

                        {day.legs?.length === 0 && day.accommodations?.length === 0 && (
                            <p className="text-xs text-ink-300 italic">Nessuna attività pianificata</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Calendar = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
);
