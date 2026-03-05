'use client';

import type { TripWithDetails } from '@/lib/types';
import TripMap from '@/components/map/TripMap';
import TripStatsCard from '@/components/trip/TripStatsCard';
import { MapPin, Calendar, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface OverviewTabProps {
    trip: TripWithDetails;
}

/**
 * Overview tab: Mapbox map of legs, quick stats, description.
 */
export default function OverviewTab({ trip }: OverviewTabProps) {
    const allLegs = trip.days?.flatMap((d) => d.legs ?? []) ?? [];

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {/* Description */}
            {trip.description && (
                <p className="text-ink-600 leading-relaxed">{trip.description}</p>
            )}

            {/* Date range info */}
            {trip.start_date && trip.end_date && (
                <div className="flex flex-wrap gap-4 text-sm text-ink-500">
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-terracotta-400" />
                        {format(new Date(trip.start_date), 'd MMM', { locale: it })} –{' '}
                        {format(new Date(trip.end_date), 'd MMM yyyy', { locale: it })}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-terracotta-400" />
                        {trip.destination}
                    </span>
                </div>
            )}

            {/* Map */}
            {allLegs.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-sand-200 shadow-card">
                    <TripMap legs={allLegs} />
                </div>
            )}

            {/* Stats */}
            <TripStatsCard tripId={trip.id} />

            {/* Members */}
            {trip.members && trip.members.length > 0 && (
                <div>
                    <h3 className="font-display text-lg font-semibold text-ink-900 mb-3">
                        <Globe className="inline w-4 h-4 mr-1 text-terracotta-400" />
                        Viaggiatori
                    </h3>
                    <div className="flex gap-3">
                        {trip.members.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-sand-100 rounded-xl text-sm">
                                <div className="w-7 h-7 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-500 font-semibold text-xs">
                                    {m.user_id.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-ink-700">{m.role === 'owner' ? 'Proprietario' : 'Membro'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
