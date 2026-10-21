import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import type { Metadata } from 'next';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TripHero from '@/components/trip/TripHero';
import { DiaryCard, TripsCard, type DiaryPost } from '@/components/trip/DashboardCards';
import {
    greetingName,
    pickHeroTrip,
    recentTrips,
    tripCountLabel,
    DASHBOARD_TRIP_COLUMNS,
    type DashboardTrip,
} from './dashboard-trips';

export const metadata: Metadata = { title: 'Oggi' };

/** "Martedì 20 ottobre": weekday capitalized, no year. */
function todayLabel(now: Date): string {
    const label = format(now, 'EEEE d MMMM', { locale: it });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Dashboard ("Oggi") — greeting, the trip that matters now (active or next),
 * then the diary and the trips. Server component, Supabase server client.
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
    const tripIds = trips.map((t) => t.id);

    // Both depend on the trips, not on each other. Posts are filtered to the
    // user's trips: RLS also exposes other people's published posts.
    const [expenses, posts] = await Promise.all([
        hero
            ? supabase.from('expenses').select('amount_eur').eq('trip_id', hero.trip.id)
            : Promise.resolve({ data: [] as { amount_eur: number | null }[] }),
        tripIds.length > 0
            ? supabase
                .from('posts')
                .select('id, title, trip_id, status')
                .in('trip_id', tripIds)
                .order('updated_at', { ascending: false })
                .limit(1)
            : Promise.resolve({ data: [] as DiaryPost[] }),
    ]);
    const heroSpent = (expenses.data ?? []).reduce((sum, e) => sum + (e.amount_eur ?? 0), 0);
    const latestPost = (posts.data?.[0] as DiaryPost | undefined) ?? null;
    const diaryTripId = hero?.trip.id ?? trips[0]?.id;

    return (
        <div className="space-y-6 md:space-y-9 animate-fade-in">
            <header className="flex flex-col gap-1 md:gap-1.5">
                <p className="type-eyebrow text-ink-muted">{todayLabel(now)}</p>
                <h1 className="type-display text-ink">Ciao {greetingName(profile?.display_name, user.email)}</h1>
            </header>

            {hero ? (
                <TripHero trip={hero.trip} kind={hero.kind} daysToStart={hero.daysToStart} spent={heroSpent} />
            ) : trips.length === 0 ? (
                <section className="bg-surface rounded-card p-8 md:p-12 shadow-sm text-center flex flex-col items-center gap-2">
                    <h2 className="type-title-2 text-ink">Pronti per una nuova avventura?</h2>
                    <p className="type-body text-ink-muted max-w-sm">
                        Pianificate il vostro prossimo viaggio e tenete traccia di tutto in un unico posto: iniziate da «Nuovo viaggio».
                    </p>
                </section>
            ) : null}

            {trips.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
                    <div className="lg:col-span-2">
                        <DiaryCard post={latestPost} writeHref={`/trips/${diaryTripId}?tab=blog`} />
                    </div>
                    <TripsCard countLabel={tripCountLabel(trips.length)} trips={listed} />
                </div>
            )}
        </div>
    );
}
