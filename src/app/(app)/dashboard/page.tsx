import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { PlusCircle, TrendingUp, MapPin, Calendar } from 'lucide-react';
import type { Trip } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Dashboard — shows active trip hero, past trips grid, and quick actions.
 * Server component — fetches data directly via Supabase server client.
 */
export default async function DashboardPage() {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    // Fetch all user's trips via trip_members join
    const { data: memberRows } = await supabase
        .from('trip_members')
        .select('trips(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const trips: Trip[] = (memberRows ?? [])
        .map((row) => row.trips as unknown as Trip)
        .filter(Boolean);

    const activeTrip = trips.find((t) => t.status === 'active');
    const pastTrips = trips.filter((t) => t.status !== 'active' && t.status !== 'archived');

    // Fetch total expenses for active trip (if any)
    let activeTripSpent = 0;
    if (activeTrip) {
        const { data: expenseRows } = await supabase
            .from('expenses')
            .select('amount_eur')
            .eq('trip_id', activeTrip.id);
        activeTripSpent = (expenseRows ?? []).reduce((sum: number, e: { amount_eur: number | null }) => sum + (e.amount_eur ?? 0), 0);
    }

    const today = format(new Date(), "EEEE d MMMM yyyy", { locale: it });

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
    const firstName = profile?.display_name || user.email?.split('@')[0] || 'Viaggiatore';

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
            {/* Top Stat Row (from image inspiration) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 card p-8 flex flex-col justify-between min-h-[220px]">
                    <div>
                        <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-1">{today}</p>
                        <h2 className="text-3xl font-bold tracking-tight">Ciao {firstName}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link 
                            href="/trips/new"
                            className="px-6 py-3 bg-[var(--color-ink)] text-white rounded-2xl text-sm font-bold shadow-panel active:scale-95 transition-all"
                        >
                            Inizia nuovo viaggio
                        </Link>
                    </div>
                </div>

                <div className="card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="p-2 bg-gray-100 rounded-xl"><Calendar className="w-5 h-5" /></span>
                        <span className="text-[10px] font-bold text-ink-muted uppercase">Statistiche</span>
                    </div>
                    <div className="mt-4">
                        <p className="text-2xl font-bold">{trips.length}</p>
                        <p className="text-xs font-semibold text-ink-muted">Viaggi totali</p>
                    </div>
                </div>

                <div className="card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="p-2 bg-gray-100 rounded-xl"><TrendingUp className="w-5 h-5" /></span>
                        <span className="text-[10px] font-bold text-ink-muted uppercase">Budget</span>
                    </div>
                    <div className="mt-4">
                        {activeTrip?.budget_eur != null ? (
                            <>
                                <p className={`text-2xl font-bold ${activeTripSpent > activeTrip.budget_eur ? 'text-red-500' : 'text-green-600'}`}>
                                    €{activeTripSpent.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs font-semibold text-ink-muted">
                                    su €{(activeTrip.budget_eur as number).toLocaleString('it-IT', { minimumFractionDigits: 0 })} budget
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
                            <Link href={`/trips/${activeTrip.id}`} className="block group">
                                <div className="card overflow-hidden h-[400px] relative">
                                    <img
                                        src={activeTrip.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'}
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
                            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">Pianifica ora il vostro prossimo viaggio di coppia e tieni traccia di tutto in un unico posto.</p>
                            <Link href="/trips/new" className="px-6 py-3 bg-[var(--color-ink)] text-white rounded-2xl text-sm font-bold">
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
                                <Link key={trip.id} href={`/trips/${trip.id}`} className="card p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                                        <img src={trip.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-ink-900 truncate">{trip.title}</p>
                                        <p className="text-[10px] font-medium text-ink-muted mt-0.5 uppercase tracking-tighter">{trip.destination}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                </Link>
                            ))}
                            <Link href="/trips" className="block text-center text-xs font-bold text-ink-muted hover:text-ink-900 uppercase tracking-widest pt-2">
                                Vedi tutti i viaggi
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
