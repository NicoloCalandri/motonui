import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Leg } from '@motonui/shared-types';
import ItineraryLegCard from './ItineraryLegCard';
import { FlightCard } from '../booking/BookingCards';

/**
 * Departures, arrivals and check-in openings are typed without a time zone
 * and stored as that same wall-clock time in UTC (lib/wall-clock.ts). They
 * must be shown as typed: formatting them in the browser's zone moves a 23:30
 * flight to 00:30 of the next day for a viewer in Italy.
 */

const leg = {
    id: 'leg-1', trip_id: 'trip-1', day_id: 'day-1', type: 'flight', from_name: 'Roma', to_name: 'Santiago',
    departure_at: '2026-11-01T23:30:00+00:00', arrival_at: '2026-11-02T13:05:00+00:00',
    carrier: null, booking_ref: null, cost: null, currency: null, notes: null,
} as unknown as Leg;

// A time that reads differently in UTC and in the zone of the machine, unless the machine is on UTC.
const SHIFTS = new Date(leg.departure_at as string).getHours() !== 23;

describe('typed times', () => {
    it('the itinerary shows the departure and the arrival as typed', () => {
        render(<ItineraryLegCard leg={leg} expanded onToggleExpand={vi.fn()} onShowBoardingPass={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);

        expect(screen.getByText('23:30 → 13:05')).toBeInTheDocument();
        expect(screen.getByText('1 nov 23:30')).toBeInTheDocument();
        expect(screen.getByText('2 nov 13:05')).toBeInTheDocument();
    });

    it('the bookings list shows the departure as typed', () => {
        render(<FlightCard leg={leg} onEdit={vi.fn()} onDelete={vi.fn()} />);

        expect(screen.getByText('1 nov · 23:30')).toBeInTheDocument();
    });

    it.runIf(SHIFTS)('runs on a machine where the browser zone would shift the time', () => {
        expect(new Date(leg.departure_at as string).getHours()).not.toBe(23);
    });
});
