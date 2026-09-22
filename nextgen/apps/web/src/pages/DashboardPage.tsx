import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { PlusCircle, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api-client';
import type { Trip, TripStats } from '@motonui/shared-types';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1';

function useTrips(token: string | undefined) {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => apiFetch<Trip[]>('/api/trips', {}, token),
    enabled: !!token,
  });
}

function useActiveTripStats(tripId: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: ['trips', tripId, 'stats'],
    queryFn: () => apiFetch<TripStats>(`/api/trips/${tripId}/stats`, {}, token),
    enabled: !!tripId && !!token,
  });
}

/**
 * Authenticated dashboard ("/dashboard") — active-trip hero, quick stats,
 * and a short list of past trips. Ported from src/app/(app)/dashboard/page.tsx.
 *
 * The old page was a Server Component that fetched trip_members/trips,
 * expenses and profile directly via Supabase at request time. Here that
 * becomes two TanStack Query calls against the already-ported Hono API:
 * GET /api/trips (list, used for the trip count, the active trip, and the
 * past-trips list) and GET /api/trips/:id/stats (used for the active
 * trip's budget_eur/total_spent_eur, since the list endpoint doesn't select
 * budget_eur). display_name/email for the greeting come from useAuth()
 * (already fetched by AuthProvider), so there's no separate profile call.
 */
export function DashboardPage() {
  const { user, profile, session } = useAuth();
  const token = session?.access_token;

  const { data: trips, isLoading } = useTrips(token);

  const activeTrip = trips?.find((t) => t.status === 'active');
  const pastTrips = (trips ?? []).filter((t) => t.status !== 'active' && t.status !== 'archived');

  const { data: activeTripStats } = useActiveTripStats(activeTrip?.id, token);

  const firstName = profile?.display_name || user?.email?.split('@')[0] || 'Viaggiatore';
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: itLocale });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-24 text-center text-sm font-semibold text-ink-muted">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Top Stat Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 card p-8 flex flex-col justify-between min-h-[220px]">
          <div>
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-1">{today}</p>
            <h2 className="text-3xl font-bold tracking-tight">Ciao {firstName}</h2>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/trips/new"
              className="px-6 py-3 bg-[var(--color-ink)] text-white rounded-2xl text-sm font-bold shadow-panel active:scale-95 transition-all"
            >
              Inizia nuovo viaggio
            </Link>
          </div>
        </div>

        <div className="card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="p-2 bg-gray-100 rounded-xl">
              <Calendar className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold text-ink-muted uppercase">Statistiche</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold">{trips?.length ?? 0}</p>
            <p className="text-xs font-semibold text-ink-muted">Viaggi totali</p>
          </div>
        </div>

        <div className="card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="p-2 bg-gray-100 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold text-ink-muted uppercase">Budget</span>
          </div>
          <div className="mt-4">
            {activeTrip && activeTripStats?.budget_eur != null ? (
              <>
                <p
                  className={`text-2xl font-bold ${
                    activeTripStats.total_spent_eur > activeTripStats.budget_eur ? 'text-red-500' : 'text-green-600'
                  }`}
                >
                  €{activeTripStats.total_spent_eur.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                </p>
                <p className="text-xs font-semibold text-ink-muted">
                  su €{activeTripStats.budget_eur.toLocaleString('it-IT', { minimumFractionDigits: 0 })} budget
                </p>
              </>
            ) : activeTrip ? (
              <>
                <p className="text-2xl font-bold text-ink-muted">—</p>
                <p className="text-xs font-semibold text-ink-muted">Imposta un budget</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-ink-muted">—</p>
                <p className="text-xs font-semibold text-ink-muted">Nessun viaggio attivo</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Trip Panel */}
        <div className="lg:col-span-2 space-y-8">
          {activeTrip ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider px-1">Location Live</h3>
              <Link to={`/trips/${activeTrip.id}`} className="block group">
                <div className="card overflow-hidden h-[400px] relative">
                  <img
                    src={activeTrip.cover_image ?? FALLBACK_COVER}
                    alt={activeTrip.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-white/20">
                      <span className="w-2 h-2 bg-terracotta-400 rounded-full animate-pulse" />
                      Viaggio attivo
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2 leading-tight">{activeTrip.title}</h2>
                    <p className="flex items-center gap-2 text-white/80 text-sm font-medium">
                      <MapPin className="w-4 h-4" /> {activeTrip.destination}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ) : (
            <div className="card p-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-transparent shadow-none min-h-[400px]">
              <PlusCircle className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pronti per una nuova avventura?</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">
                Pianifica ora il vostro prossimo viaggio di coppia e tieni traccia di tutto in un unico posto.
              </p>
              <Link to="/trips/new" className="px-6 py-3 bg-[var(--color-ink)] text-white rounded-2xl text-sm font-bold">
                Crea Viaggio
              </Link>
            </div>
          )}
        </div>

        {/* Side Panels (Past & Utils) */}
        <div className="space-y-8">
          {/* Past Trips List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider px-1">Recent Trips</h3>
            <div className="space-y-4">
              {pastTrips.slice(0, 3).map((trip) => (
                <Link
                  key={trip.id}
                  to={`/trips/${trip.id}`}
                  className="card p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={trip.cover_image ?? FALLBACK_COVER} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink-900 truncate">{trip.title}</p>
                    <p className="text-[10px] font-medium text-ink-muted mt-0.5 uppercase tracking-tighter">
                      {trip.destination}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </Link>
              ))}
              <Link
                to="/trips"
                className="block text-center text-xs font-bold text-ink-muted hover:text-ink-900 uppercase tracking-widest pt-2"
              >
                Vedi tutti i viaggi
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
