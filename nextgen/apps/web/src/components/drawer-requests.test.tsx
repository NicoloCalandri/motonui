import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Accommodation, Leg } from '@motonui/shared-types';
import LegDrawer from './trip/LegDrawer';
import AccommodationDrawer from './trip/AccommodationDrawer';
import ActivityDrawer from './booking/ActivityDrawer';
import RestaurantDrawer from './booking/RestaurantDrawer';

/**
 * What the drawers send. Two things the API refuses and the route contract
 * test cannot see: an edit opened without a day (the bookings list) must use
 * the day of the item or the day-less route, never ".../days/undefined/...",
 * and a field left empty must go as null, not as an empty string.
 */

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));
vi.mock('../lib/auth-context', () => ({
    useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'token-1' }, profile: null, isLoading: false, profileLoading: false }),
}));

const TRIP = '10000000-0000-4000-8000-00000000000a';
const DAY = '30000000-0000-4000-8000-00000000000d';
const ITEM = '40000000-0000-4000-8000-00000000000e';

const leg = (day_id: string | null) => ({
    id: ITEM, trip_id: TRIP, day_id, type: 'train', from_name: 'Roma', to_name: 'Firenze',
    from_lat: 41.9, from_lng: 12.5, to_lat: 43.77, to_lng: 11.25,
    departure_at: '2026-11-01T09:00:00+00:00', arrival_at: '2026-11-01T10:30:00+00:00',
    cost: null, currency: 'EUR', carrier: null, booking_ref: null, pnr: null, checkin_opens_at: null,
    boarding_pass_path: null, boarding_pass_url: null, notes: null,
}) as unknown as Leg;

const accommodation = (day_id: string | null) => ({
    id: ITEM, trip_id: TRIP, day_id, name: 'Hotel Hanga Roa', address: null, check_in: '2026-11-01', check_out: '2026-11-03',
    cost: null, currency: 'EUR', booking_ref: null, payment_deadline: null, cancellation_deadline: null,
}) as unknown as Accommodation;

function show(element: ReactElement) {
    return render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>);
}

async function save(name: RegExp) {
    await userEvent.setup().click(screen.getByRole('button', { name }));
    await waitFor(() => expect(mockApiFetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method)).toBe(true));
    const [path, init] = mockApiFetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method) as [string, RequestInit];
    return { path, method: init.method, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({});
});

describe('editing from a list that has no day', () => {
    it('saves a leg on the route of its own day', async () => {
        show(<LegDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} initialData={leg(DAY)} />);

        const { path, method } = await save(/salva modifiche/i);

        expect(method).toBe('PUT');
        expect(path).toBe(`/api/trips/${TRIP}/days/${DAY}/legs/${ITEM}`);
    });

    it('saves a leg without a day on the day-less route', async () => {
        show(<LegDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} initialData={leg(null)} />);

        const { path } = await save(/salva modifiche/i);

        expect(path).toBe(`/api/trips/${TRIP}/legs/${ITEM}`);
    });

    it('saves an accommodation on the route of its own day', async () => {
        show(<AccommodationDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} initialData={accommodation(DAY)} />);

        const { path, method } = await save(/salva modifiche/i);

        expect(method).toBe('PUT');
        expect(path).toBe(`/api/trips/${TRIP}/days/${DAY}/accommodations/${ITEM}`);
    });

    it('saves an accommodation without a day on the day-less route', async () => {
        show(<AccommodationDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} initialData={accommodation(null)} />);

        const { path } = await save(/salva modifiche/i);

        expect(path).toBe(`/api/trips/${TRIP}/accommodations/${ITEM}`);
    });

    it('never builds a path with an undefined segment', async () => {
        show(<LegDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} initialData={leg(DAY)} />);

        const { path } = await save(/salva modifiche/i);

        expect(path).not.toMatch(/undefined|null/);
    });
});

describe('fields left empty', () => {
    it('an accommodation without deadlines sends them as null', async () => {
        show(<AccommodationDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} initialData={accommodation(DAY)} />);

        const { body } = await save(/salva modifiche/i);

        expect(body).toMatchObject({ payment_deadline: null, cancellation_deadline: null });
        expect(Object.values(body)).not.toContain('');
    });

    it('an activity without date and time sends them as null', async () => {
        const user = userEvent.setup();
        show(<ActivityDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} />);
        await user.type(screen.getByLabelText(/nome attività/i), 'Museo Egizio');
        await user.type(screen.getByLabelText(/durata/i), '90');

        const { body } = await save(/^aggiungi attività$/i);

        expect(body).toMatchObject({ name: 'Museo Egizio', date: null, time: null });
        expect(Object.values(body)).not.toContain('');
    });

    it('a restaurant without a time sends it as null', async () => {
        const user = userEvent.setup();
        show(<RestaurantDrawer tripId={TRIP} open onClose={vi.fn()} onSaved={vi.fn()} />);
        await user.type(screen.getByLabelText(/nome ristorante/i), 'Te Moana');

        const { body } = await save(/^aggiungi ristorante$/i);

        expect(body).toMatchObject({ name: 'Te Moana', time: null });
        expect(Object.values(body)).not.toContain('');
    });
});
