'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/lib/fetcher';
import type { TripStats } from '@/lib/types';
import { Globe, Navigation, TrendingUp, Clock } from 'lucide-react';

/**
 * Fetches and displays aggregated trip stats.
 */
export default function TripStatsCard({ tripId }: { tripId: string }) {
    const { data: stats, isLoading: loading } = useSWR<TripStats>(tripId ? `/api/trips/${tripId}/stats` : null, jsonFetcher);

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="card p-4 animate-pulse">
                        <div className="h-3 bg-sand-200 rounded mb-2 w-2/3" />
                        <div className="h-6 bg-sand-200 rounded w-1/2" />
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) return null;

    const statItems = [
        { label: 'Giorni', value: stats.total_days, icon: Clock, color: 'text-terracotta-400' },
        { label: 'Km percorsi', value: `${stats.total_km_traveled.toLocaleString('it-IT')} km`, icon: Navigation, color: 'text-sage-400' },
        { label: 'Paesi', value: stats.countries_visited.length, icon: Globe, color: 'text-terracotta-400' },
        { label: 'Spese totali', value: `€${stats.total_spent_eur.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-sage-400' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statItems.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="card p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="text-xs text-ink-400">{label}</span>
                    </div>
                    <p className="font-display text-xl font-semibold text-ink-900">{value}</p>
                </div>
            ))}
        </div>
    );
}
