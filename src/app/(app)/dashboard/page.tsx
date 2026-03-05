import { createClient } from '@/lib/supabase/server';
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
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch all user's trips via trip_members join
    const { data: memberRows } = await supabase
        .from('trip_members')
        .select('trips(*)')
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: false });

    const trips: Trip[] = (memberRows ?? [])
        .map((row) => row.trips as unknown as Trip)
        .filter(Boolean);

    const activeTrip = trips.find((t) => t.status === 'active');
    const pastTrips = trips.filter((t) => t.status !== 'active' && t.status !== 'archived');

    const today = format(new Date(), "EEEE d MMMM yyyy", { locale: it });
    const firstName = user?.email?.split('@')[0] ?? 'Viaggiatore';

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto pb-28 md:pb-8">
            {/* Greeting */}
            <div className="mb-8 animate-fade-in">
                <p className="text-ink-400 text-sm capitalize">{today}</p>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-900 mt-1">
                    Ciao {firstName} 👋
                </h1>
            </div>

            {/* Active Trip Hero */}
            {activeTrip ? (
                <Link href={`/trips/${activeTrip.id}`} className="block mb-8 animate-fade-in">
                    <div className="relative rounded-3xl overflow-hidden shadow-card-hover group">
                        {activeTrip.cover_image ? (
                            <img
                                src={activeTrip.cover_image}
                                alt={activeTrip.title}
                                className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="w-full h-64 md:h-80 bg-gradient-to-br from-terracotta-300 to-sage-300" />
                        )}
                        <div className="absolute inset-0 hero-gradient" />
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-terracotta-400/90 rounded-full text-xs font-medium mb-2">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                Viaggio in corso
                            </div>
                            <h2 className="font-display text-2xl md:text-3xl font-bold">{activeTrip.title}</h2>
                            <div className="flex items-center gap-4 mt-2 text-white/80 text-sm">
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{activeTrip.destination}</span>
                                {activeTrip.end_date && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Fino al {format(new Date(activeTrip.end_date), 'd MMM', { locale: it })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </Link>
            ) : (
                /* Empty state */
                <div className="mb-8 rounded-3xl border-2 border-dashed border-sand-300 p-10 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-sand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-sand-400" />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-ink-700 mb-2">
                        Nessun viaggio attivo
                    </h2>
                    <p className="text-ink-400 text-sm mb-4">Inizia a pianificare la vostra prossima avventura</p>
                    <Link
                        href="/trips/new"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta-400 text-white rounded-xl text-sm font-medium hover:bg-terracotta-500 transition-colors"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Crea il primo viaggio
                    </Link>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                    { href: '/trips/new', label: 'Nuovo viaggio', icon: PlusCircle, color: 'bg-terracotta-50 text-terracotta-400' },
                    { href: activeTrip ? `/trips/${activeTrip.id}?tab=expenses` : '/trips', label: 'Aggiungi spesa', icon: TrendingUp, color: 'bg-sage-50 text-sage-400' },
                    { href: activeTrip ? `/trips/${activeTrip.id}?tab=media` : '/trips', label: 'Carica foto', icon: MapPin, color: 'bg-sand-200 text-ink-500' },
                ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                        key={href}
                        href={href}
                        className="card p-4 flex flex-col items-center gap-2 text-center hover:scale-105 transition-transform duration-150"
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-ink-700 leading-tight">{label}</span>
                    </Link>
                ))}
            </div>

            {/* Past Trips Grid */}
            {pastTrips.length > 0 && (
                <section>
                    <h2 className="font-display text-xl font-semibold text-ink-900 mb-4">
                        I vostri viaggi
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {pastTrips.map((trip) => (
                            <Link key={trip.id} href={`/trips/${trip.id}`} className="card group overflow-hidden">
                                {trip.cover_image ? (
                                    <img
                                        src={trip.cover_image}
                                        alt={trip.title}
                                        className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-36 bg-gradient-to-br from-sand-200 to-sage-100" />
                                )}
                                <div className="p-3">
                                    <h3 className="font-display font-semibold text-ink-900 text-sm leading-tight">{trip.title}</h3>
                                    <p className="text-ink-400 text-xs mt-0.5">{trip.destination}</p>
                                </div>
                            </Link>
                        ))}
                        <Link
                            href="/trips/new"
                            className="card p-4 flex flex-col items-center justify-center gap-2 min-h-[154px] border-2 border-dashed border-sand-300 bg-transparent hover:bg-sand-50 transition-colors"
                        >
                            <PlusCircle className="w-7 h-7 text-sand-400" />
                            <span className="text-xs text-ink-400 text-center">Nuovo viaggio</span>
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
