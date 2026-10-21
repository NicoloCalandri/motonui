import Link from 'next/link';
import { ChevronRight, PenLine } from 'lucide-react';
import TripCover from './TripCover';

export type DiaryPost = { id: string; title: string; trip_id: string; status: string };
export type TripRow = { id: string; title: string; destination: string; cover_image: string | null };

/** "Diario": the latest post, or an invitation to write the first one in the hero trip. */
export function DiaryCard({ post, writeHref }: { post: DiaryPost | null; writeHref: string }) {
    return (
        <section aria-labelledby="diary-title" className="bg-surface rounded-card p-5 md:px-8 md:py-7 shadow-sm flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-4 md:gap-5">
            <div className="flex-1 md:basis-[260px] flex flex-col gap-1.5">
                <p className="type-eyebrow text-ink-muted">Diario</p>
                {post ? (
                    <>
                        <h2 id="diary-title" className="type-title-3 md:type-title-2 text-ink">{post.title}</h2>
                        <p className="type-body text-ink-muted">{post.status === 'published' ? 'Pubblicato sul blog' : 'Bozza'}</p>
                    </>
                ) : (
                    <>
                        <h2 id="diary-title" className="type-title-3 md:type-title-2 text-ink">Il diario è ancora in bianco.</h2>
                        <p className="type-body text-ink-muted">Raccontate il viaggio in due, anche mentre lo vivete.</p>
                    </>
                )}
            </div>
            <Link
                href={post ? `/trips/${post.trip_id}/posts/${post.id}/edit` : writeHref}
                className="pressable self-start md:self-auto h-11 pl-3.5 pr-[18px] rounded-pill bg-canvas text-ink flex items-center gap-2 type-body font-semibold"
            >
                <PenLine className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
                {post ? 'Continua a scrivere' : 'Scrivi il primo post'}
            </Link>
        </section>
    );
}

/** "Viaggi": how many, the other recent trips, the way to the full list. */
export function TripsCard({ countLabel, trips }: { countLabel: string; trips: TripRow[] }) {
    const [count, ...noun] = countLabel.split(' ');
    return (
        <section aria-labelledby="trips-title" className="bg-surface rounded-card p-5 md:px-8 md:py-7 shadow-sm flex flex-col gap-2.5">
            <h2 id="trips-title" className="type-eyebrow text-ink-muted">Viaggi</h2>
            <p className="flex items-baseline gap-2.5">
                <span className="font-display font-bold text-5xl leading-none tracking-[-0.02em] text-ink">{count}</span>
                <span className="type-body text-ink-muted">{noun.join(' ')}</span>
            </p>
            {trips.length > 0 && (
                <ul className="flex flex-col divide-y divide-separator mt-1">
                    {trips.map((trip) => (
                        <li key={trip.id}>
                            <Link href={`/trips/${trip.id}`} className="pressable flex items-center gap-3 py-2.5 min-h-11">
                                <span className="w-11 h-11 rounded-[12px] overflow-hidden shrink-0 bg-sea">
                                    <TripCover tripId={trip.id} coverImage={trip.cover_image} className="w-full h-full" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block type-body font-semibold text-ink truncate">{trip.title}</span>
                                    <span className="block type-footnote text-ink-muted truncate">{trip.destination}</span>
                                </span>
                                <ChevronRight className="w-[18px] h-[18px] text-ink-muted" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <Link href="/trips" className="mt-1 min-h-11 flex items-center gap-1 type-body font-semibold text-ink self-start">
                Vedi tutti i viaggi
                <ChevronRight className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
            </Link>
        </section>
    );
}
