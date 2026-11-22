import { CardListSkeleton } from '@/components/ui/skeleton';

/** Streams while the dashboard server component reads trips and posts (audit B1.30). */
export default function Loading() {
    return <CardListSkeleton label="Caricamento della giornata…" cards={2} />;
}
