import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import type { Metadata } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { PlusCircle, ChevronRight, MapPin, Calendar } from 'lucide-react';
import TripCover from '@/components/trip/TripCover';
import {
    greetingName,
    pickHeroTrip,
    recentTrips,
    tripCountLabel,
    DASHBOARD_TRIP_COLUMNS,
    type DashboardTrip,
    type HeroTrip,
} from './dashboard-trips';

export const metadata: Metadata = { title: 'Dashboard' };

const euro = (value: number) => `€${value.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`;

function tripDates(trip: DashboardTrip): string | null {
    if (!trip.start_date) return null;
    const start = format(parseISO(trip.start_date), 'd MMM yyyy', { locale: it });
    if (!trip.end_date) return start;
    return `${start} – ${format(parseISO(trip.end_date), 'd MMM yyyy', { locale: it })}`;
}

function countdown(hero: HeroTrip): string {
    if (hero.daysToStart === null) return 'In programmazione';
    if (hero.daysToStart === 0) return 'Partite oggi';
    if (hero.daysToStart === 1) return 'Partite domani';
    return `Partite tra ${hero.daysToStart} giorni`;
}

function HeroCard({ hero, spent }: { hero: HeroTrip; spent: number }) {
    const { trip } = hero;
    const dates = tripDates(trip);
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider px-1">
                {hero.kind === 'active' ? 'Viaggio in corso' : 'Prossimo viaggio'}
            </h3>
            <Link href={`/trips/${trip.id}`} className="block group">
                <div className="card card-interactive overflow-hidden h-[400px] relative">
                    <TripCover
                        tripId={trip.id}
                        coverImage={trip.cover_image}
                        className="w-full h-full group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/20">
                            <span className="w-2 h-2 bg-terracotta-400 rounded-full animate-pulse" />
                            {hero.kind === 'active' ? 'Viaggio attivo' : 'Prossimo viaggio'}
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2 leading-tight">{trip.title}</h2>
                        <p className="flex items-center gap-2 text-white/80 text-sm font-medium">
                            <MapPin className="w-4 h-4" /> {trip.destination}
                        </p>
                        {(dates || hero.kind === 'upcoming') && (
                            <p className="flex items-center gap-2 text-white/80 text-sm font-medium mt-1">
                                <Calendar className="w-4 h-4" />
                                {[dates, hero.kind === 'upcoming' ? countdown(hero) : null].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                </div>
            </Link>
            <div className="card p-5 flex items-center justify-between">
                <span className="text-xs font-bold text-ink-muted uppercase">Budget</span>
                {trip.budget_eur != null ? (
                    <p className="text-sm font-semibold text-ink-900">
                        <span className={spent > trip.budget_eur ? 'text-red-600' : 'text-green-700'}>{euro(spent)}</span>
                        {' '}su {euro(trip.budget_eur)}
                    </p>
                ) : (
                    <Link href={`/trips/${trip.id}?tab=overview`} className="text-sm font-semibold text-ink-900 underline">
                        Imposta budget
                    </Link>
                )}
            </div>
        </div>
    );
}

/**
 * Dashboard — greeting, the trip that matters now (active or next), recent trips.
 * Server component — fetches data directly via Supabase server client.
 */
export default async function DashboardPage() {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    // Trips and profile do not depend on each other: one round trip instead of two.
    const [{ data: memberRows }, { data: profile }] = await Promise.all([
        supabase
            .from('trip_members')
            .select(`trips(${DASHBOARD_TRIP_COLUMNS})`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    ]);

    const trips: DashboardTrip[] = (memberRows ?? [])
        .map((row) => row.trips as unknown as DashboardTrip)
        .filter(Boolean);

    const now = new Date();
    const hero = pickHeroTrip(trips, now);
    const listed = recentTrips(trips, hero?.trip.id ?? null);

    let heroSpent = 0;
    if (hero) {
        const { data: expenseRows } = await supabase
            .from('expenses')
            .select('amount_eur')
            .eq('trip_id', hero.trip.id);
        heroSpent = (expenseRows ?? []).reduce((sum: number, e: { amount_eur: number | null }) => sum + (e.amount_eur ?? 0), 0);
    }

    const today = format(now, 'EEEE d MMMM yyyy', { locale: it });

    const firstName = greetingName(profile?.display_name, user.email);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            Nuovo viaggio
                        </Link>
                    </div>
                </div>

                <div className="card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="p-2 bg-gray-100 rounded-xl"><Calendar className="w-5 h-5" /></span>
                        <span className="text-xs font-bold text-ink-muted uppercase">Statistiche</span>
                    </div>
                    <p className="mt-4 text-2xl font-bold">{tripCountLabel(trips.length)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {hero ? (
                    <div className="lg:col-span-2">
                        <HeroCard hero={hero} spent={heroSpent} />
                    </div>
                ) : trips.length === 0 ? (
                    <div className="lg:col-span-2 card p-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-transparent shadow-none min-h-[400px]">
                        <PlusCircle className="w-12 h-12 text-gray-300 mb-4" aria-hidden="true" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Pronti per una nuova avventura?</h3>
                        <p className="text-gray-600 text-sm max-w-xs mx-auto">Pianificate il vostro prossimo viaggio e tenete traccia di tutto in un unico posto.</p>
                    </div>
                ) : null}

                <div className={`space-y-4 ${hero || trips.length === 0 ? '' : 'lg:col-span-3'}`}>
                    <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider px-1">Ultimi viaggi</h3>
                    <div className="space-y-4">
                        {listed.map((trip) => (
                            <Link key={trip.id} href={`/trips/${trip.id}`} className="card card-interactive p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                                    <TripCover tripId={trip.id} coverImage={trip.cover_image} className="w-full h-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-ink-900 truncate">{trip.title}</p>
                                    <p className="text-xs font-medium text-ink-muted mt-0.5 uppercase">{trip.destination}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
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
    );
}
