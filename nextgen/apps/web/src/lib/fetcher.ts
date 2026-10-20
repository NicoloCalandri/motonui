/**
 * Fetcher for SWR (T-3.5): GET a JSON endpoint of our API. Non-2xx answers
 * throw a FetchError carrying the standard `{ error }` message, so components
 * can show it instead of silently rendering an empty list.
 */

export const DEFAULT_FETCH_ERROR = 'Ops! Non riusciamo a caricare i dati. Riprova tra poco 🏝️';

export class FetchError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'FetchError';
    }
}

function errorMessage(body: unknown): string {
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error;
    return DEFAULT_FETCH_ERROR;
}

export async function jsonFetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new FetchError(errorMessage(body), res.status);
    return body as T;
}
