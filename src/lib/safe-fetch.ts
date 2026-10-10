/**
 * Server-side fetch towards third parties (T-2.4, SR-INT-05, SR-INPUT-07):
 * HTTPS only, host in an explicit allowlist, no redirects, bounded time.
 * Every server `fetch` to an external service goes through here.
 */

export const EXTERNAL_HOSTS = {
    openMeteo: ['geocoding-api.open-meteo.com', 'api.open-meteo.com', 'archive-api.open-meteo.com'],
    exchangeRate: ['v6.exchangerate-api.com'],
} as const;

export const DEFAULT_TIMEOUT_MS = 8_000;

export class SafeFetchError extends Error {
    constructor(message: string) {
        super(`[motonui][safe-fetch] ${message}`);
        this.name = 'SafeFetchError';
    }
}

export interface SafeFetchOptions extends Omit<RequestInit, 'redirect' | 'signal'> {
    allowedHosts: readonly string[];
    timeoutMs?: number;
}

export async function safeFetch(input: string | URL, options: SafeFetchOptions): Promise<Response> {
    const { allowedHosts, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;

    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new SafeFetchError('invalid URL');
    }

    if (url.protocol !== 'https:') throw new SafeFetchError(`protocol not allowed: ${url.protocol}`);
    if (url.username || url.password) throw new SafeFetchError('credentials in URL not allowed');
    if (url.port && url.port !== '443') throw new SafeFetchError(`port not allowed: ${url.port}`);
    if (!allowedHosts.includes(url.hostname)) throw new SafeFetchError(`host not allowed: ${url.hostname}`);

    const response = await fetch(url, {
        ...init,
        // A redirect could lead outside the allowlist: treat it as an error.
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
    });
    return response;
}
