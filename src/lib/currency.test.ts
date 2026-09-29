import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryChain } from '@/test/supabase-mock';
import { computeRate, convertCents, convertCurrency, fetchRates, fromCents, toCents } from './currency';

const RATES = { USD: 1.08, JPY: 162.5, GBP: 0.85 };
const NOW = new Date('2026-09-29T12:00:00Z');

function clientWith(cached: object | null) {
    const read = queryChain({ data: cached, error: null });
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ ...read, insert })) } as unknown as SupabaseClient;
    return { supabase, read, insert };
}

describe('pure conversion', () => {
    it('computes rates through EUR', () => {
        expect(computeRate(RATES, 'EUR', 'EUR')).toBe(1);
        expect(computeRate(RATES, 'EUR', 'USD')).toBe(1.08);
        expect(computeRate(RATES, 'USD', 'EUR')).toBeCloseTo(1 / 1.08, 10);
        expect(computeRate(RATES, 'usd', 'jpy')).toBeCloseTo(162.5 / 1.08, 10);
    });

    it('returns null for unknown or invalid rates', () => {
        expect(computeRate(RATES, 'CHF', 'EUR')).toBeNull();
        expect(computeRate({ USD: 0 }, 'USD', 'EUR')).toBeNull();
        expect(computeRate({ USD: Number.NaN }, 'USD', 'EUR')).toBeNull();
        expect(computeRate({ USD: -1 }, 'USD', 'EUR')).toBeNull();
    });

    it('converts integer cents', () => {
        expect(toCents(19.99)).toBe(1999);
        expect(toCents(0.1 + 0.2)).toBe(30);
        expect(fromCents(1999)).toBe(19.99);
        expect(convertCents(10000, 1 / 1.08)).toBe(9259);
    });
});

describe('fetchRates', () => {
    it('uses the cached rates when fresh (24 h)', async () => {
        const { supabase, read } = clientWith({ rates: RATES, fetched_at: NOW.toISOString() });
        const fetchImpl = vi.fn();

        expect(await fetchRates({ supabase, now: NOW, apiKey: 'k', fetchImpl })).toEqual(RATES);
        expect(read.calls).toContainEqual(['gte', ['fetched_at', '2026-09-28T12:00:00.000Z']]);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('fetches and caches fresh rates on a miss', async () => {
        const { supabase, insert } = clientWith(null);
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ conversion_rates: RATES })));

        expect(await fetchRates({ supabase, now: NOW, apiKey: 'secret key', fetchImpl })).toEqual(RATES);
        const [url, options] = fetchImpl.mock.calls[0] as unknown as [string, { allowedHosts: string[] }];
        expect(url).toBe('https://v6.exchangerate-api.com/v6/secret%20key/latest/EUR');
        expect(options.allowedHosts).toContain('v6.exchangerate-api.com');
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ rates: RATES, fetched_at: NOW.toISOString() }));
    });

    it('returns no rates without an API key', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { supabase } = clientWith(null);
        expect(await fetchRates({ supabase, now: NOW, apiKey: '' })).toEqual({});
    });
});

describe('convertCurrency', () => {
    it('returns the same amount when currencies match, without I/O', async () => {
        const supabase = { from: vi.fn() } as unknown as SupabaseClient;
        expect(await convertCurrency(100, 'EUR', 'eur', { supabase })).toBe(100);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('converts with the cached rates, rounded to the cent', async () => {
        const { supabase } = clientWith({ rates: RATES });
        expect(await convertCurrency(100, 'USD', 'EUR', { supabase, now: NOW })).toBe(92.59);
    });

    it('returns null — never the unconverted amount — when a rate is missing (T-3.2)', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { supabase } = clientWith({ rates: RATES });
        expect(await convertCurrency(100, 'CHF', 'EUR', { supabase, now: NOW })).toBeNull();
    });

    it('returns null when the rate service fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { supabase } = clientWith(null);
        const fetchImpl = vi.fn(async () => new Response('down', { status: 503 }));
        expect(await convertCurrency(100, 'USD', 'EUR', { supabase, now: NOW, apiKey: 'k', fetchImpl })).toBeNull();
    });
});
