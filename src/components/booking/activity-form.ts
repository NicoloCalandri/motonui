/** Form schema and activity kinds of the activity drawer. */
import { z } from 'zod';

export const Schema = z.object({
    name: z.string().min(1, 'Nome attività richiesto').max(200),
    type: z.enum(['museum', 'tour', 'excursion', 'show', 'sport', 'other']).default('tour'),
    address: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    time: z.string().optional().nullable(),
    duration_min: z.coerce.number().int().min(1).optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().default('EUR'),
    booking_ref: z.string().optional().nullable(),
    ticket_url: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export type FormValues = z.infer<typeof Schema>;

export const ACTIVITY_TYPES = [
    { value: 'museum', label: 'Museo', emoji: '🏛️' },
    { value: 'tour', label: 'Tour', emoji: '🚶' },
    { value: 'excursion', label: 'Escursione', emoji: '🥾' },
    { value: 'show', label: 'Spettacolo', emoji: '🎭' },
    { value: 'sport', label: 'Sport', emoji: '⛷️' },
    { value: 'other', label: 'Altro', emoji: '📍' },
] as const;

