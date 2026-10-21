import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, ChevronRight, Images, Route, Wallet } from 'lucide-react';
import TripCover from './TripCover';

export type TripHeroTrip = {
    id: string;
    title: string;
    destination: string;
    cover_image: string | null;
    start_date: string | null;
    end_date: string | null;
    budget_eur: number | null;
};

interface TripHeroProps {
    trip: TripHeroTrip;
    kind: 'active' | 'upcoming';
    /** Calendar days to departure; null without a future start date. */
    daysToStart: number | null;
    /** Sum of the converted expenses, in euro. */
    spent: number;
}

const QUICK_ACTIONS = [
    { tab: 'itinerary', label: 'Itinerario', icon: Route },
    { tab: 'expenses', label: 'Spese', icon: Wallet },
    { tab: 'media', label: 'Foto', icon: Images },
];

export const formatEuro = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

function tripDates(trip: TripHeroTrip): string | null {
    if (!trip.start_date) return null;
    const start = format(parseISO(trip.start_date), 'd MMM yyyy', { locale: it });
    if (!trip.end_date) return start;
    return `${start} – ${format(parseISO(trip.end_date), 'd MMM yyyy', { locale: it })}`;
}

function countdown(daysToStart: number | null): string {
    if (daysToStart === null) return 'In programmazione';
    if (daysToStart === 0) return 'Partite oggi';
    if (daysToStart === 1) return 'Partite domani';
    return `Partite tra ${daysToStart} giorni`;
}

/**
 * The trip that matters now: horizontal on desktop (cover 55% / details 45%),
 * stacked on mobile. The title is the link to the trip; the quick actions are
 * separate links, so no link is nested in another.
 */
export default function TripHero({ trip, kind, daysToStart, spent }: TripHeroProps) {
    const dates = tripDates(trip);
    const overBudget = trip.budget_eur != null && spent > trip.budget_eur;

    return (
        <section aria-labelledby="hero-title" className="bg-surface rounded-card overflow-hidden shadow-hero flex flex-col md:flex-row">
            <div className="relative h-[188px] md:h-auto md:min-h-[380px] md:basis-[55%] bg-sea">
                <TripCover tripId={trip.id} coverImage={trip.cover_image} className="absolute inset-0 w-full h-full" />
            </div>
            <div className="md:basis-[45%] p-5 md:px-10 md:py-9 flex flex-col gap-4 md:gap-5">
                <div className="flex flex-col gap-2 md:gap-3">
                    <span className="self-start h-7 px-3 rounded-pill bg-beacon-tint text-beacon-ink type-eyebrow flex items-center gap-2">
                        <span aria-hidden="true" className="w-2 h-2 rounded-pill bg-beacon" />
                        {kind === 'active' ? 'In viaggio' : 'Prossimo viaggio'}
                    </span>
                    <h2 id="hero-title" className="type-title-2 md:type-title-1 text-ink">
                        <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-1.5 hover:underline underline-offset-4">
                            {trip.title}
                            <ChevronRight className="w-6 h-6 shrink-0" strokeWidth={2} aria-hidden="true" />
                        </Link>
                    </h2>
                    <p className="type-body text-ink-muted">{[trip.destination, dates].filter(Boolean).join(' · ')}</p>
                </div>

                {kind === 'upcoming' && (
                    <p className="type-headline text-ink flex items-center gap-2.5">
                        <Calendar className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
                        {countdown(daysToStart)}
                    </p>
                )}

                <div className="flex items-center justify-between gap-3 py-3.5 border-y border-separator">
                    <span className="type-body text-ink-muted">Budget del viaggio</span>
                    {trip.budget_eur != null ? (
                        <p className="type-body font-semibold text-ink">
                            <span className={overBudget ? 'text-red-700' : undefined}>{formatEuro(spent)}</span>
                            {' '}su {formatEuro(trip.budget_eur)}
                        </p>
                    ) : (
                        <Link href={`/trips/${trip.id}?tab=overview`} className="type-body font-semibold text-ink underline underline-offset-[3px] min-h-11 flex items-center">
                            Imposta budget
                        </Link>
                    )}
                </div>

                <nav aria-label="Azioni rapide" className="grid grid-cols-3 gap-2 md:gap-3 md:mt-auto">
                    {QUICK_ACTIONS.map(({ tab, label, icon: Icon }) => (
                        <Link
                            key={tab}
                            href={`/trips/${trip.id}?tab=${tab}`}
                            className="pressable min-h-16 md:min-h-[72px] rounded-control bg-canvas text-ink flex flex-col items-center justify-center gap-1.5 type-footnote font-semibold"
                        >
                            <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden="true" />
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </section>
    );
}
