import type { Accommodation, Activity, Leg, Restaurant } from '@/lib/types';

/** Chronological order of bookings; undated ones last, then by name. */

function toTimestamp(value: string | null | undefined): number {
    if (!value) return Number.POSITIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function mergeDateTime(date: string | null | undefined, time: string | null | undefined): string | null {
    if (!date) return null;
    return `${date}T${time ?? '00:00'}:00`;
}

export function compareLegByDate(a: Leg, b: Leg): number {
    const aTs = toTimestamp(a.departure_at ?? a.arrival_at);
    const bTs = toTimestamp(b.departure_at ?? b.arrival_at);
    if (aTs !== bTs) return aTs - bTs;
    return a.from_name.localeCompare(b.from_name);
}

export function compareAccommodationByDate(a: Accommodation, b: Accommodation): number {
    const aTs = toTimestamp(a.check_in ?? a.check_out);
    const bTs = toTimestamp(b.check_in ?? b.check_out);
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
}

export function compareRestaurantByDate(a: Restaurant, b: Restaurant): number {
    const aTs = toTimestamp(mergeDateTime(a.date, a.time));
    const bTs = toTimestamp(mergeDateTime(b.date, b.time));
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
}

export function compareActivityByDate(a: Activity, b: Activity): number {
    const aTs = toTimestamp(mergeDateTime(a.date, a.time));
    const bTs = toTimestamp(mergeDateTime(b.date, b.time));
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
}
