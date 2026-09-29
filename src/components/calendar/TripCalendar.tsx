'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Bell, Clock } from 'lucide-react';
import { jsonFetcher } from '@/lib/fetcher';
import type { TripWithDetails, Restaurant, Activity } from '@/lib/types';
import { buildCalendarEvents } from './calendar-events';

interface TripCalendarProps {
    trip: TripWithDetails;
}

/**
 * Trip calendar — month view showing all trip events:
 * flights, hotels, restaurants, activities, deadlines, reminders.
 */
export default function TripCalendar({ trip }: TripCalendarProps) {
    // Same keys as the bookings tab: the SWR cache is shared.
    const { data: restaurants = [] } = useSWR<Restaurant[]>(`/api/trips/${trip.id}/restaurants`, jsonFetcher, { fallbackData: trip.restaurants ?? [] });
    const { data: activities = [] } = useSWR<Activity[]>(`/api/trips/${trip.id}/activities`, jsonFetcher, { fallbackData: trip.activities ?? [] });

    // Start at trip start date, or current month
    const initialDate = trip.start_date ? new Date(trip.start_date) : new Date();
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(initialDate));

    // Build events from all trip data
    const events = useMemo(() => buildCalendarEvents(trip, restaurants, activities), [trip, restaurants, activities]);

    // Calendar grid
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart); // 0=Sun, 1=Mon, ...
    // Italian calendar starts on Monday (1)
    const paddingDays = (startDayOfWeek + 6) % 7;

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const selectedEvents = selectedDate
        ? events.filter(e => isSameDay(e.date, selectedDate))
        : [];

    const getEventsForDay = (date: Date) => events.filter(e => isSameDay(e.date, date));

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-xl font-semibold text-ink-900">Calendario</h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 rounded-lg hover:bg-sand-100 text-ink-400 transition-colors"
                        aria-label="Mese precedente"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-display font-semibold text-ink-900 min-w-[140px] text-center capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: it })}
                    </span>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 rounded-lg hover:bg-sand-100 text-ink-400 transition-colors"
                        aria-label="Mese successivo"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
                {[
                    { label: 'Voli', color: 'bg-blue-400' },
                    { label: 'Hotel', color: 'bg-emerald-400' },
                    { label: 'Ristoranti', color: 'bg-orange-400' },
                    { label: 'Attività', color: 'bg-purple-400' },
                    { label: 'Scadenze', color: 'bg-amber-400' },
                ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                        <span className="text-ink-400">{label}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="card overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-sand-100">
                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                        <div key={day} className="text-center py-2 text-xs font-semibold text-ink-400 uppercase tracking-wide">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                    {/* Padding cells for days before month starts */}
                    {Array.from({ length: paddingDays }).map((_, i) => (
                        <div key={`pad-${i}`} className="min-h-[80px] md:min-h-[100px] border-b border-r border-sand-50" />
                    ))}

                    {daysInMonth.map(day => {
                        const dayEvents = getEventsForDay(day);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const today = isToday(day);

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(isSelected ? null : day)}
                                className={`min-h-[80px] md:min-h-[100px] border-b border-r border-sand-50 p-1 text-left transition-colors hover:bg-sand-50 ${
                                    isSelected ? 'bg-terracotta-50 ring-1 ring-terracotta-200' : ''
                                }`}
                            >
                                <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full ${
                                    today ? 'bg-terracotta-400 text-white' : 'text-ink-700'
                                }`}>
                                    {format(day, 'd')}
                                </span>

                                {/* Event dots */}
                                <div className="mt-1 space-y-0.5">
                                    {dayEvents.slice(0, 3).map(evt => (
                                        <div
                                            key={evt.id}
                                            className={`${evt.color} ${evt.textColor} rounded px-1 py-0.5 text-[10px] font-semibold truncate leading-tight`}
                                        >
                                            {evt.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <span className="text-[10px] text-ink-400 font-medium">
                                            +{dayEvents.length - 3} altri
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selected Day Detail */}
            {selectedDate && (
                <div className="card p-4 space-y-3">
                    <h3 className="font-display font-semibold text-ink-900 capitalize">
                        {format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}
                    </h3>
                    {selectedEvents.length === 0 ? (
                        <p className="text-sm text-ink-400">Nessun evento in questa giornata</p>
                    ) : (
                        <div className="space-y-2">
                            {selectedEvents.map(evt => {
                                const Icon = evt.icon;
                                return (
                                    <div key={evt.id} className={`flex items-center gap-3 p-3 rounded-xl ${evt.color}`}>
                                        <Icon className={`w-4 h-4 ${evt.textColor} flex-shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold ${evt.textColor}`}>{evt.title}</p>
                                            {evt.subtitle && (
                                                <p className={`text-xs ${evt.textColor} opacity-75`}>{evt.subtitle}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Upcoming Events */}
            <div className="card p-4">
                <h3 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-terracotta-400" />
                    Prossimi eventi
                </h3>
                {(() => {
                    const now = new Date();
                    const upcoming = events
                        .filter(e => e.date >= now)
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .slice(0, 5);

                    if (upcoming.length === 0) {
                        return <p className="text-sm text-ink-400">Nessun evento in programma</p>;
                    }

                    return (
                        <div className="space-y-2">
                            {upcoming.map(evt => {
                                const Icon = evt.icon;
                                return (
                                    <div key={evt.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-sand-50 transition-colors">
                                        <div className={`w-8 h-8 ${evt.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                            <Icon className={`w-4 h-4 ${evt.textColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-ink-800 truncate">{evt.title}</p>
                                            {evt.subtitle && <p className="text-xs text-ink-400">{evt.subtitle}</p>}
                                        </div>
                                        <span className="text-xs text-ink-400 flex items-center gap-1 flex-shrink-0">
                                            <Clock className="w-3 h-3" />
                                            {format(evt.date, 'd MMM', { locale: it })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
