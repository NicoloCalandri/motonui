import { CardListSkeleton } from '@/components/ui/skeleton';

/** Streams while the profile page loads (audit B1.30). */
export default function Loading() {
    return <CardListSkeleton label="Caricamento del profilo…" cards={2} />;
}
