import { supabase } from './supabase-client';

/**
 * The session token on the API requests made with plain `fetch`.
 *
 * Components copied from the Next.js app (scripts/port-lib.mjs, WEB_COPIES)
 * call `fetch('/api/…')` and SWR's fetcher without knowing about tokens:
 * there, the session cookie authenticates the request. Here the session is a
 * bearer token, so `fetch` is wrapped once, at startup, to add it.
 *
 * The token goes only to this origin, only under `/api/`, and never replaces
 * an Authorization header the caller set (apiFetch still passes its own).
 */
export function withApiAuth(
    fetchImpl: typeof fetch,
    getToken: () => Promise<string | null>,
    origin: string,
    // Relative URLs resolve against the page, as the browser will do when it sends them.
    baseUrl: () => string = () => origin,
): typeof fetch {
    const isOwnApi = (input: RequestInfo | URL): boolean => {
        const raw = input instanceof Request ? input.url : String(input);
        let url: URL;
        try {
            url = new URL(raw, baseUrl());
        } catch {
            return false;
        }
        return url.origin === origin && url.pathname.startsWith('/api/');
    };

    return async (input, init) => {
        if (!isOwnApi(input)) return fetchImpl(input, init);

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (headers.has('authorization')) return fetchImpl(input, init);

        const token = await getToken();
        if (!token) return fetchImpl(input, init);

        headers.set('Authorization', `Bearer ${token}`);
        return input instanceof Request ? fetchImpl(new Request(input, { ...init, headers })) : fetchImpl(input, { ...init, headers });
    };
}

/** Wraps `window.fetch` with the Supabase session token. Called once, in main.tsx. */
export function installApiAuth(): void {
    const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;
    window.fetch = withApiAuth(window.fetch.bind(window), getToken, window.location.origin, () => document.baseURI);
}
