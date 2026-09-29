// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryChain } from '@/test/supabase-mock';
import { geocodeDestination, getTripWeather } from './weather';

const NOW = new Date('2026-10-01T08:00:00Z');

function cacheClient(cached: object | null) {
    const read = queryChain({ data: cached, error: null });
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ ...read, upsert })) } as unknown as SupabaseClient;
    return { supabase, read, upsert };
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

describe('weather', () => {
    const fetchMock = vi.fn();

    beforeEach(() => vi.stubGlobal('fetch', fetchMock));
    afterEach(() => {
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it('geocodes a destination through Open-Meteo only', async () => {
        fetchMock.mockResolvedValueOnce(json({ results: [{ latitude: -27.12, longitude: -109.35 }] }));

        expect(await geocodeDestination('Isola di Pasqua')).toEqual({ lat: -27.12, lng: -109.35 });
        const url = String(fetchMock.mock.calls[0][0]);
        expect(new URL(url).hostname).toBe('geocoding-api.open-meteo.com');
        expect(url).toContain('name=Isola%20di%20Pasqua');
    });

    it('returns null when nothing matches or the service fails', async () => {
        fetchMock.mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({}, 500));
        expect(await geocodeDestination('Nowhere')).toBeNull();
        expect(await geocodeDestination('Nowhere')).toBeNull();
    });

    it('serves a cached forecast younger than 12 h', async () => {
        const payload = [{ date: '2026-10-02', temp_max_c: 20, temp_min_c: 12, precipitation_probability: 10, condition: 'sereno' }];
        const { supabase, read } = cacheClient({ payload, fetched_at: NOW.toISOString() });

        expect(await getTripWeather(-27.1, -109.3, '2026-10-02', '2026-10-02', supabase, NOW)).toEqual(payload);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(read.calls).toContainEqual(['gte', ['fetched_at', '2026-09-30T20:00:00.000Z']]);
    });

    it('fetches and caches the forecast for near dates', async () => {
        const { supabase, upsert } = cacheClient(null);
        fetchMock.mockResolvedValueOnce(json({
            daily: { time: ['2026-10-02'], temperature_2m_max: [21], temperature_2m_min: [13], precipitation_probability_max: [40], weathercode: [61] },
        }));

        const days = await getTripWeather(-27.1, -109.3, '2026-10-02', '2026-10-02', supabase, NOW);

        expect(days).toEqual([{ date: '2026-10-02', temp_max_c: 21, temp_min_c: 13, precipitation_probability: 40, condition: 'pioggia' }]);
        expect(new URL(String(fetchMock.mock.calls[0][0])).hostname).toBe('api.open-meteo.com');
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({ cache_key: '-27.1_-109.3_2026-10-02_2026-10-02_forecast', fetched_at: NOW.toISOString() }),
            { onConflict: 'cache_key' },
        );
    });

    it('averages past years for dates beyond the forecast horizon, skipping missing years', async () => {
        const { supabase } = cacheClient(null);
        const year = (max: number, code: number) => json({
            daily: { time: ['x'], temperature_2m_max: [max], temperature_2m_min: [max - 10], precipitation_sum: [2], weathercode: [code] },
        });
        fetchMock.mockResolvedValueOnce(year(20, 0)).mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(year(24, 3));

        const days = await getTripWeather(10, 10, '2027-01-10', '2027-01-10', supabase, NOW);

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(new URL(String(fetchMock.mock.calls[0][0])).hostname).toBe('archive-api.open-meteo.com');
        expect(days).toEqual([{ date: '2027-01-10', temp_max_c: 22, temp_min_c: 12, precipitation_probability: 40, condition: 'sereno' }]);
    });

    it('returns "meteo non disponibile" when no year has data', async () => {
        const { supabase } = cacheClient(null);
        fetchMock.mockResolvedValue(json({}, 500));

        const days = await getTripWeather(10, 10, '2027-01-10', '2027-01-11', supabase, NOW);

        expect(days.map((d) => d.condition)).toEqual(['meteo non disponibile', 'meteo non disponibile']);
    });
});
