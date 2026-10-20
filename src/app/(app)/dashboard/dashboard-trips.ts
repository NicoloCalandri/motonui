import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Columns the dashboard reads from `trips`. */
export type DashboardTrip = {
    id: string;
    title: string;
    destination: string;
    cover_image: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    budget_eur: number | null;
};

export type HeroTrip = {
    trip: DashboardTrip;
    kind: 'active' | 'upcoming';
    /** Calendar days until departure; null without a future start date. */
    daysToStart: number | null;
};

const LIST_STATUSES = ['active', 'planning', 'completed'];

/** First word of the display name ("Nicolò Calandri" → "Nicolò"), else the email local part. */
export function greetingName(displayName: string | null | undefined, email: string | null | undefined): string {
    const first = displayName?.trim().split(/\s+/)[0];
    return first || email?.split('@')[0] || 'Viaggiatore';
}

export function tripCountLabel(count: number): string {
    return count === 1 ? '1 viaggio' : `${count} viaggi`;
}

function daysUntil(date: string | null, now: Date): number | null {
    if (!date) return null;
    const days = differenceInCalendarDays(parseISO(date), now);
    return days >= 0 ? days : null;
}

/** Ascending by date, trips without a date last. */
function byDateAsc(a: string | null, b: string | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : 1;
}

/** Descending by date, trips without a date last. */
function byDateDesc(a: string | null, b: string | null): number {
    if (a === null || b === null) return byDateAsc(a, b);
    return byDateAsc(b, a);
}

/**
 * The trip the dashboard puts first: the active one, otherwise the planned
 * trip that leaves soonest (undated or past-dated plans after dated ones).
 */
export function pickHeroTrip(trips: DashboardTrip[], now: Date): HeroTrip | null {
    const active = trips.find((t) => t.status === 'active');
    if (active) return { trip: active, kind: 'active', daysToStart: null };

    const planned = trips
        .filter((t) => t.status === 'planning')
        .map((trip) => ({ trip, daysToStart: daysUntil(trip.start_date, now) }))
        .sort((a, b) => {
            if ((a.daysToStart === null) !== (b.daysToStart === null)) return a.daysToStart === null ? 1 : -1;
            return byDateAsc(a.trip.start_date, b.trip.start_date);
        });
    const next = planned[0];
    return next ? { trip: next.trip, kind: 'upcoming', daysToStart: next.daysToStart } : null;
}

/**
 * "Ultimi viaggi": everything but the hero and archived trips. Active first,
 * then planned by departure, then completed from the most recent.
 */
export function recentTrips(trips: DashboardTrip[], heroId: string | null, limit = 3): DashboardTrip[] {
    const rank = (status: string) => LIST_STATUSES.indexOf(status);
    return trips
        .filter((t) => t.id !== heroId && rank(t.status) !== -1)
        .sort((a, b) => {
            const byStatus = rank(a.status) - rank(b.status);
            if (byStatus !== 0) return byStatus;
            if (a.status === 'completed') return byDateDesc(a.end_date, b.end_date);
            return byDateAsc(a.start_date, b.start_date);
        })
        .slice(0, limit);
}
