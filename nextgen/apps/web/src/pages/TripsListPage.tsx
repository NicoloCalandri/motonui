import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { MapPin, Calendar, PlusCircle, ArrowRight, Plane } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api-client';
import { DeleteTripButton } from '../components/DeleteTripButton';
import type { Trip } from '@motonui/shared-types';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1';

function useTrips(token: string | undefined) {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => apiFetch<Trip[]>('/api/trips', {}, token),
    enabled: !!token,
  });
}

/**
 * Full trips list ("/trips"). Ported from src/app/(app)/trips/page.tsx.
 *
 * The old page was a Server Component that fetched trip_members/trips
 * directly via a Supabase server client and filtered out archived trips
 * client-side. Here that becomes the same `useQuery(['trips'], ...)` /
 * `GET /api/trips` call DashboardPage (Task 4.7) already uses — same query
 * key, so the cache is shared between the two pages — with the identical
 * `status !== 'archived'` filter applied to the response.
 */
export function TripsListPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading } = useTrips(token);
  const trips = (data ?? []).filter((t) => t.status !== 'archived');

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-24 text-center text-sm font-semibold text-neutral-400">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-neutral-900 mb-3">I vostri viaggi</h1>
          <p className="text-neutral-500 font-medium max-w-lg">
            Tutte le vostre avventure passate, presenti e future raccolte in un unico posto.
          </p>
        </div>
        <Link
          to="/trips/new"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl text-sm font-bold shadow-panel hover:bg-black transition-all active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          Crea nuovo viaggio
        </Link>
      </div>

      {/* Trips Grid */}
      {trips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trips.map((trip) => (
            <div key={trip.id} className="relative group">
              <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
              <Link to={`/trips/${trip.id}`} className="block h-full">
                <div className="card h-full flex flex-col overflow-hidden border-none shadow-soft hover:shadow-panel transition-all duration-500 rounded-[32px]">
                  {/* Cover Image */}
                  <div className="h-56 relative overflow-hidden">
                    <img
                      src={trip.cover_image ?? FALLBACK_COVER}
                      alt={trip.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 right-4">
                      <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-white border border-white/20">
                        {trip.status === 'active' ? '🌍 In corso' : '✅ Completato'}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
                        <MapPin className="w-3.5 h-3.5" />
                        {trip.destination}
                      </div>
                      <h3 className="text-2xl font-bold text-neutral-900 group-hover:text-ink-900 transition-colors">
                        {trip.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                        <Calendar className="w-4 h-4" />
                        {trip.start_date ? format(new Date(trip.start_date), 'd MMM yyyy', { locale: itLocale }) : 'Prossimamente'}
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-neutral-50 flex items-center justify-between text-neutral-300 group-hover:text-neutral-900 transition-colors">
                      <span className="text-xs font-bold uppercase tracking-widest">Dettagli viaggio</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-neutral-100 bg-white/50 min-h-[500px] rounded-[48px]">
          <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mb-8">
            <Plane className="w-10 h-10 text-neutral-200" />
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 mb-4">Ancora nessun viaggio?</h3>
          <p className="text-neutral-500 text-sm max-w-sm mx-auto mb-10 leading-relaxed font-medium">
            Il mondo è troppo grande per restare a casa. Inizia a pianificare la vostra prossima avventura di coppia.
          </p>
          <Link to="/trips/new" className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold shadow-panel hover:bg-black transition-all">
            Crea il tuo Primo Viaggio
          </Link>
        </div>
      )}
    </div>
  );
}
