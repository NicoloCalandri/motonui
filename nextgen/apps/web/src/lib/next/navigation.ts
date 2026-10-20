import { useMemo } from 'react';
import {
    useLocation,
    useNavigate,
    useParams as useRouterParams,
    useSearchParams as useRouterSearchParams,
} from 'react-router-dom';
import { mutate } from 'swr';

/**
 * Stands in for `next/navigation` in components copied from the Next.js app
 * (scripts/port-lib.mjs rewrites the import): the hooks client components
 * use, on top of react-router.
 */

export function useRouter() {
    const navigate = useNavigate();
    return useMemo(() => ({
        push: (href: string) => { void navigate(href); },
        replace: (href: string) => { void navigate(href, { replace: true }); },
        back: () => { void navigate(-1); },
        // Next.js re-renders the server components; here the data lives in the
        // SWR cache, so every key is revalidated.
        refresh: () => { void mutate(() => true); },
        prefetch: (_href: string) => {},
    }), [navigate]);
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
    return useRouterParams() as T;
}

/** Read-only, like the Next.js hook: writing goes through the router. */
export function useSearchParams(): URLSearchParams {
    return useRouterSearchParams()[0];
}

export function usePathname(): string {
    return useLocation().pathname;
}
