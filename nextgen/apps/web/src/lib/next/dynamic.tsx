import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

interface DynamicOptions {
    /** Shown while the chunk loads. */
    loading?: () => ReactNode;
    /** Accepted and ignored: the SPA renders in the browser only. */
    ssr?: boolean;
}

/**
 * Stands in for `next/dynamic` in components copied from the Next.js app
 * (scripts/port-lib.mjs rewrites the import): the same code-split chunk,
 * through React.lazy and Suspense.
 */
export default function dynamic<P extends object>(
    loader: () => Promise<{ default: ComponentType<P> }>,
    options: DynamicOptions = {},
): ComponentType<P> {
    const Lazy = lazy(loader);
    function Dynamic(props: P) {
        return (
            <Suspense fallback={options.loading ? options.loading() : null}>
                <Lazy {...props} />
            </Suspense>
        );
    }
    return Dynamic;
}
