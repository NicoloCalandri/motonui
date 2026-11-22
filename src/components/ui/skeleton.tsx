/**
 * Loading placeholders (audit B1.30). Shapes match the real layout so the
 * page does not jump when the data arrives; screen readers hear one status
 * message instead of a pile of empty boxes.
 */

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-sand-200 ${className}`} />;
}

interface SkeletonPageProps {
    label: string;
    children: React.ReactNode;
}

/** Wraps a skeleton layout with a polite status for assistive technology. */
export function SkeletonPage({ label, children }: SkeletonPageProps) {
    return (
        <div role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">{label}</span>
            {children}
        </div>
    );
}

/** Trip detail: hero, tab bar, two content cards. */
export function TripDetailSkeleton() {
    return (
        <SkeletonPage label="Caricamento del viaggio…">
            <div className="flex flex-col min-h-screen">
                <Skeleton className="h-48 md:h-72 rounded-none" />
                <div className="flex gap-3 px-4 py-3 border-b border-sand-200 overflow-hidden">
                    {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6 w-20 flex-shrink-0" />)}
                </div>
                <div className="p-4 md:p-6 space-y-4">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        </SkeletonPage>
    );
}

/** A list of trip or diary cards. */
export function CardListSkeleton({ label, cards = 3 }: { label: string; cards?: number }) {
    return (
        <SkeletonPage label={label}>
            <div className="p-4 md:p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: cards }, (_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
            </div>
        </SkeletonPage>
    );
}
