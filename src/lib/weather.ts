import { SupabaseClient } from '@supabase/supabase-js';
import type { DailyWeather } from '@/lib/types';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const FORECAST_HORIZON_DAYS = 16; // Open-Meteo forecast API only covers ~16 days ahead
const HISTORICAL_YEARS = 3; // years averaged for the climate-approximation fallback

/**
 * Resolves a free-text destination to coordinates via Open-Meteo's geocoding
 * API (no API key required). Returns null if nothing matches.
 */
export async function geocodeDestination(destination: string): Promise<{ lat: number; lng: number } | null> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=it`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const json = (await response.json()) as { results?: { latitude: number; longitude: number }[] };
    const first = json.results?.[0];
    return first ? { lat: first.latitude, lng: first.longitude } : null;
}

/**
 * Returns a normalized daily weather forecast (or historical climate average
 * for dates beyond the forecast horizon) for the given coordinates and date
 * range. Results are cached in Supabase `weather_cache` for 12h.
 */
export async function getTripWeather(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string,
    supabase: SupabaseClient
): Promise<DailyWeather[]> {
    const roundedLat = lat.toFixed(1);
    const roundedLng = lng.toFixed(1);
    const isForecast = daysFromNow(startDate) <= FORECAST_HORIZON_DAYS;
    const mode = isForecast ? 'forecast' : 'historical';
    const cacheKey = `${roundedLat}_${roundedLng}_${startDate}_${endDate}_${mode}`;

    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const { data: cached } = await (supabase.from('weather_cache') as any)
        .select('payload, fetched_at')
        .eq('cache_key', cacheKey)
        .gte('fetched_at', cutoff)
        .maybeSingle();

    if (cached?.payload) {
        return cached.payload as DailyWeather[];
    }

    const days = isForecast
        ? await fetchForecast(lat, lng, startDate, endDate)
        : await fetchHistoricalAverage(lat, lng, startDate, endDate);

    await (supabase.from('weather_cache') as any).upsert(
        { cache_key: cacheKey, payload: days, fetched_at: new Date().toISOString() },
        { onConflict: 'cache_key' }
    );

    return days;
}

function daysFromNow(dateStr: string): number {
    const target = new Date(`${dateStr}T00:00:00Z`).getTime();
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

async function fetchForecast(lat: number, lng: number, startDate: string, endDate: string): Promise<DailyWeather[]> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
        `&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`[motonui][weather][forecast] Open-Meteo error: ${response.status}`);

    const json = await response.json();
    return normalizeDaily(json.daily?.time ?? [], {
        tempMax: json.daily?.temperature_2m_max ?? [],
        tempMin: json.daily?.temperature_2m_min ?? [],
        precipProb: json.daily?.precipitation_probability_max ?? [],
        weatherCode: json.daily?.weathercode ?? [],
    });
}

/**
 * No key-free API provides multi-year seasonal averages directly, so this
 * approximates a "typical" forecast by averaging the archive (historical
 * observed) weather for the same calendar dates across the past few years.
 */
async function fetchHistoricalAverage(lat: number, lng: number, startDate: string, endDate: string): Promise<DailyWeather[]> {
    const dayOffsets = enumerateDates(startDate, endDate);
    const perYearResults: DailyWeather[][] = [];

    for (let yearsBack = 1; yearsBack <= HISTORICAL_YEARS; yearsBack++) {
        const shiftedStart = shiftYear(startDate, -yearsBack);
        const shiftedEnd = shiftYear(endDate, -yearsBack);

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
            `&timezone=auto&start_date=${shiftedStart}&end_date=${shiftedEnd}`;

        const response = await fetch(url);
        if (!response.ok) continue; // skip a missing year rather than failing the whole request

        const json = await response.json();
        const days = normalizeDaily(json.daily?.time ?? [], {
            tempMax: json.daily?.temperature_2m_max ?? [],
            tempMin: json.daily?.temperature_2m_min ?? [],
            // archive has no probability field — approximate from rainfall volume
            precipProb: (json.daily?.precipitation_sum ?? []).map((mm: number) => Math.min(100, Math.round(mm * 20))),
            weatherCode: json.daily?.weathercode ?? [],
        });
        perYearResults.push(days);
    }

    if (perYearResults.length === 0) {
        // No archive data available (e.g. geocoding pointed somewhere with no coverage) —
        // return empty rather than throwing, the checklist can still be generated without weather.
        return dayOffsets.map((date) => ({
            date,
            temp_max_c: NaN,
            temp_min_c: NaN,
            precipitation_probability: 0,
            condition: 'meteo non disponibile',
        }));
    }

    return dayOffsets.map((date, idx) => {
        const samples = perYearResults.map((year) => year[idx]).filter(Boolean);
        if (samples.length === 0) {
            return { date, temp_max_c: NaN, temp_min_c: NaN, precipitation_probability: 0, condition: 'meteo non disponibile' };
        }
        const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
        return {
            date,
            temp_max_c: Math.round(avg(samples.map((s) => s.temp_max_c))),
            temp_min_c: Math.round(avg(samples.map((s) => s.temp_min_c))),
            precipitation_probability: Math.round(avg(samples.map((s) => s.precipitation_probability))),
            condition: samples[0].condition,
        };
    });
}

function normalizeDaily(
    dates: string[],
    values: { tempMax: number[]; tempMin: number[]; precipProb: number[]; weatherCode: number[] }
): DailyWeather[] {
    return dates.map((date, idx) => ({
        date,
        temp_max_c: values.tempMax[idx],
        temp_min_c: values.tempMin[idx],
        precipitation_probability: values.precipProb[idx] ?? 0,
        condition: wmoToItalian(values.weatherCode[idx]),
    }));
}

function enumerateDates(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cursor.getTime() <= end.getTime()) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

function shiftYear(dateStr: string, years: number): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + years);
    return d.toISOString().slice(0, 10);
}

function wmoToItalian(code: number): string {
    if (code === 0) return 'sereno';
    if ([1, 2, 3].includes(code)) return 'parzialmente nuvoloso';
    if ([45, 48].includes(code)) return 'nebbia';
    if ([51, 53, 55, 56, 57].includes(code)) return 'pioviggine';
    if ([61, 63, 65, 66, 67].includes(code)) return 'pioggia';
    if ([71, 73, 75, 77].includes(code)) return 'neve';
    if ([80, 81, 82].includes(code)) return 'rovesci di pioggia';
    if ([85, 86].includes(code)) return 'rovesci di neve';
    if ([95, 96, 99].includes(code)) return 'temporale';
    return 'variabile';
}
