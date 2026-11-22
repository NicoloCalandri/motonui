import { CardListSkeleton } from '@/components/ui/skeleton';

/** Streams while the trip list is read on the server (audit B1.30). */
export default function Loading() {
    return <CardListSkeleton label="Caricamento dei viaggi…" cards={4} />;
}
