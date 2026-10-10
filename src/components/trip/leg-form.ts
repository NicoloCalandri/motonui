import { z } from 'zod';
import type { Leg } from '@/lib/types';

// ─── Flight segment (multi-stop support) ─────────────────────────────────────
export interface FlightSegment {
    from_name: string;  // e.g. "TRN — Torino"
    to_name: string;
    from_lat?: number | null;
    from_lng?: number | null;
    to_lat?: number | null;
    to_lng?: number | null;
}

export const defaultSegment = (): FlightSegment => ({ from_name: '', to_name: '' });

export const LEG_TYPES = [
    { id: 'flight', label: 'Volo', emoji: '✈️' },
    { id: 'train', label: 'Treno', emoji: '🚆' },
    { id: 'car', label: 'Auto', emoji: '🚗' },
    { id: 'ferry', label: 'Traghetto', emoji: '⛴️' },
    { id: 'bus', label: 'Bus', emoji: '🚌' },
    { id: 'walk', label: 'A piedi', emoji: '🚶' },
    { id: 'other', label: 'Altro', emoji: '📍' },
];

export const Schema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1, 'Origine richiesta').max(200),
    to_name: z.string().min(1, 'Destinazione richiesta').max(200),
    departure_date: z.string().optional(),
    departure_time: z.string().optional(),
    arrival_date: z.string().optional(),
    arrival_time: z.string().optional(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().default('EUR'),
    carrier: z.string().optional().nullable(),
    booking_ref: z.string().optional().nullable(),
    pnr: z.string().optional().nullable(),
    checkin_opens_at: z.string().optional().nullable(),
});

export type FormValues = z.infer<typeof Schema>;
/** Form input shape: fields with a schema default are optional before parsing. */
export type FormInput = z.input<typeof Schema>;

export type Coords = { lat: number; lng: number };

/**
 * ISO local timestamps from the form: a time without a date falls back to the
 * day of the drawer, then to the leg being edited.
 */
export function legTimes(values: FormValues, fallbackDate?: string, initial?: { departure_at: string | null; arrival_at: string | null }) {
    const depDate = values.departure_date ?? fallbackDate ?? initial?.departure_at?.slice(0, 10);
    const arrDate = values.arrival_date ?? fallbackDate ?? initial?.arrival_at?.slice(0, 10);
    return {
        departure_at: depDate && values.departure_time ? `${depDate}T${values.departure_time}:00` : null,
        arrival_at: arrDate && values.arrival_time ? `${arrDate}T${values.arrival_time}:00` : null,
        checkin_opens_at: values.checkin_opens_at ? `${values.checkin_opens_at}:00` : null,
    };
}

/** Complete segments of a multi-stop flight, as the API expects them. */
export function segmentsPayload(segments: FlightSegment[]) {
    return segments
        .filter((s) => s.from_name && s.to_name)
        .map((s) => ({
            from_name: s.from_name,
            to_name: s.to_name,
            from_lat: s.from_lat ?? null,
            from_lng: s.from_lng ?? null,
            to_lat: s.to_lat ?? null,
            to_lng: s.to_lng ?? null,
        }));
}

/** Form values of a saved leg; dates default to the day of the drawer. */
export function formValuesFromLeg(leg: Leg, dayDate?: string): FormValues {
    return {
        type: leg.type,
        from_name: leg.from_name,
        to_name: leg.to_name,
        departure_date: leg.departure_at ? leg.departure_at.slice(0, 10) : dayDate,
        departure_time: leg.departure_at ? leg.departure_at.slice(11, 16) : undefined,
        arrival_date: leg.arrival_at ? leg.arrival_at.slice(0, 10) : dayDate,
        arrival_time: leg.arrival_at ? leg.arrival_at.slice(11, 16) : undefined,
        cost: leg.cost ?? undefined,
        currency: leg.currency,
        carrier: leg.carrier ?? undefined,
        booking_ref: leg.booking_ref ?? undefined,
        pnr: leg.pnr ?? undefined,
        checkin_opens_at: leg.checkin_opens_at ? leg.checkin_opens_at.slice(0, 16) : undefined,
    };
}

export function coordsOf(lat: number | null | undefined, lng: number | null | undefined): Coords | null {
    return lat != null && lng != null ? { lat, lng } : null;
}
