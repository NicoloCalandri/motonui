import { useQuery } from '@tanstack/react-query';
import { Globe, Navigation, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api-client';
import type { TripStats } from '@motonui/shared-types';

/**
 * Fetches and displays aggregated trip stats. Ported from
 * src/components/trip/TripStatsCard.tsx.
 *
 * Touchpoint change from the old component: raw `fetch('/api/trips/:id/stats')`
 * in a `useEffect` -> `useQuery(['trips', tripId, 'stats'], ...)` via
 * `apiFetch` with the auth token from `useAuth()`, matching
 * DashboardPage's `useActiveTripStats` (same query key shape and
 * endpoint) so the two share the TanStack Query cache for the same trip.
 */
export default function TripStatsCard({ tripId }: { tripId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['trips', tripId, 'stats'],
    queryFn: () => apiFetch<TripStats>(`/api/trips/${tripId}/stats`, {}, token),
    enabled: !!tripId && !!token,
    // The expenses tab is copied from the Next.js app and writes through SWR:
    // this cache does not hear about it, so the totals are read again each
    // time the card appears instead of being served from the last 30 seconds.
    staleTime: 0,
    refetchOnMount: 'always',
  });

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
