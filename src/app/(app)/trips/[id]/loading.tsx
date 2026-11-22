import { TripDetailSkeleton } from '@/components/ui/skeleton';

/** Shown on navigation, before the trip page's own SWR request starts (audit B1.30). */
export default function Loading() {
    return <TripDetailSkeleton />;
}
