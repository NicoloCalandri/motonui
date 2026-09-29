import type { SupabaseClient } from '@supabase/supabase-js';
import { EXTERNAL_HOSTS, safeFetch } from '@/lib/safe-fetch';

/**
 * Currency conversion (T-3.2, SR-INT-05, FR-21).
 *
 * - `computeRate` and `convertCents` are pure: rates in, number out.
 * - `fetchRates` reads the 24 h cache or the exchange-rate API.
 * - When a rate is missing the result is `null`, never the unconverted
 *   amount: the expense stays "da convertire" and is left out of totals and
 *   balances instead of counting 100 USD as 100 EUR.
 *
 * Money is handled in integer cents; the database keeps NUMERIC(12, 2).
 */

export const BASE_CURRENCY = 'EUR';
export const RATES_TTL_MS = 24 * 60 * 60 * 1000;

/** Rates relative to EUR: 1 EUR = rates[code] units of `code`. */
export type Rates = Record<string, number>;

export interface CurrencyDeps {
    supabase: SupabaseClient;
    now?: Date;
    apiKey?: string;
    fetchImpl?: typeof safeFetch;
}

export function toCents(amount: number): number {
    return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
    return cents / 100;
}

/** Multiplier from `from` to `to`, or null if either rate is unknown or invalid. */
export function computeRate(rates: Rates, from: string, to: string): number | null {
    const source = from.toUpperCase();
    const target = to.toUpperCase();
    if (source === target) return 1;

    const fromRate = source === BASE_CURRENCY ? 1 : rates[source];
    const toRate = target === BASE_CURRENCY ? 1 : rates[target];
    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || !fromRate || !toRate || fromRate <= 0 || toRate <= 0) {
        return null;
    }
    return toRate / fromRate;
}

export function convertCents(cents: number, rate: number): number {
    return Math.round(cents * rate);
}

/** Cached rates (24 h) or a fresh copy from the API; `{}` when unavailable. */
export async function fetchRates(deps: CurrencyDeps): Promise<Rates> {
    const now = deps.now ?? new Date();
    const cutoff = new Date(now.getTime() - RATES_TTL_MS).toISOString();

    const { data: cached } = await deps.supabase
        .from('currency_rates')
        .select('rates, fetched_at')
        .gte('fetched_at', cutoff)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (cached?.rates) return cached.rates as Rates;

    const apiKey = deps.apiKey ?? process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
        console.warn('[motonui][currency] EXCHANGE_RATE_API_KEY not set — rates unavailable');
        return {};
    }

    const fetchImpl = deps.fetchImpl ?? safeFetch;
    const response = await fetchImpl(
        `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/${BASE_CURRENCY}`,
        { allowedHosts: EXTERNAL_HOSTS.exchangeRate },
    );
    if (!response.ok) throw new Error(`[motonui][currency] Exchange rate API error: ${response.status}`);

    const json = (await response.json()) as { conversion_rates?: Rates };
    const rates = json.conversion_rates ?? {};

    await deps.supabase.from('currency_rates').insert({
        base_currency: BASE_CURRENCY,
        rates,
        fetched_at: now.toISOString(),
    });
    return rates;
}

/**
 * Converts an amount (in units, e.g. 12.50) between currencies. Returns null
 * when no rate is available, so callers store `amount_eur = null`.
 */
export async function convertCurrency(
    amount: number,
    from: string,
    to: string,
    deps: CurrencyDeps,
): Promise<number | null> {
    if (from.toUpperCase() === to.toUpperCase()) return amount;

    try {
        const rate = computeRate(await fetchRates(deps), from, to);
        if (rate === null) {
            console.warn(`[motonui][currency] Missing rate for ${from} → ${to}`);
            return null;
        }
        return fromCents(convertCents(toCents(amount), rate));
    } catch (error) {
        console.error('[motonui][currency] Conversion failed:', error);
        return null;
    }
}
