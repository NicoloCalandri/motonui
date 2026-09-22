import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingsTab from './BookingsTab';
import type { TripWithDetails, Leg, Accommodation, Restaurant, Activity } from '@motonui/shared-types';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderBookings(trip: TripWithDetails, props: Partial<Parameters<typeof BookingsTab>[0]> = {}) {
    return render(<BookingsTab trip={trip} {...props} />);
}

/** The open drawer's primary submit button shares its accessible name with the
 * underlying section's "Aggiungi ..." empty-state button (still in the DOM behind the
 * drawer overlay), so `getByRole` by name alone is ambiguous — target the drawer's
 * `data-submit-mode="save"` button explicitly instead. */
function getDrawerSubmitButton(container: HTMLElement): HTMLButtonElement {
    return container.querySelector('button[data-submit-mode="save"]') as HTMLButtonElement;
}

/** Mounting BookingsTab always fires all four list GETs (restaurants, activities, legs,
 * accommodations), in that order, regardless of what's already on `trip`. */
function mockInitialFetches(opts: {
    restaurants?: Restaurant[];
    activities?: Activity[];
    legs?: Leg[];
    accommodations?: Accommodation[];
} = {}) {
    mockApiFetch.mockResolvedValueOnce(opts.restaurants ?? []);
    mockApiFetch.mockResolvedValueOnce(opts.activities ?? []);
    mockApiFetch.mockResolvedValueOnce(opts.legs ?? []);
    mockApiFetch.mockResolvedValueOnce(opts.accommodations ?? []);
}

const makeLeg = (overrides: Partial<Leg> = {}): Leg => ({
    id: 'leg-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1',
    day_id: null,
    type: 'flight',
    from_name: 'Roma',
    to_name: 'Tokyo',
    from_lat: 41.9,
    from_lng: 12.5,
    to_lat: 35.6,
    to_lng: 139.7,
    departure_at: null,
    arrival_at: null,
    duration_min: 720,
    cost: null,
    currency: 'EUR',
    carrier: null,
    booking_ref: null,
    pnr: null,
    boarding_pass_url: null,
    checkin_opens_at: null,
    notes: null,
    sort_order: 0,
    ...overrides,
});

const makeAcc = (overrides: Partial<Accommodation> = {}): Accommodation => ({
    id: 'acc-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1',
    day_id: null,
    name: 'Grand Hotel Plaza',
    address: 'Via Roma 1',
    lat: null,
    lng: null,
    check_in: '2025-04-01',
    check_out: '2025-04-05',
    cost: null,
    currency: 'EUR',
    booking_ref: null,
    payment_deadline: null,
    cancellation_deadline: null,
    notes: null,
    url: null,
    ...overrides,
});

const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
    id: 'rest-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1',
    day_id: null,
    name: 'Trattoria da Mario',
    cuisine_type: 'Italiana',
    address: null,
    lat: null,
    lng: null,
    date: '2025-04-02',
    time: '20:00',
    covers: 2,
    cost: null,
    currency: 'EUR',
    booking_ref: null,
    confirmation_url: null,
    phone: null,
    notes: null,
    sort_order: 0,
    ...overrides,
});

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
    id: 'activity-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1',
    day_id: null,
    name: 'Tour del Colosseo',
    type: 'tour',
    address: null,
    lat: null,
    lng: null,
    date: '2025-04-01',
    time: null,
    duration_min: 120,
    cost: null,
    currency: 'EUR',
    booking_ref: null,
    ticket_url: null,
    notes: null,
    sort_order: 0,
    ...overrides,
});

const makeTrip = (overrides: Partial<TripWithDetails> = {}): TripWithDetails => ({
    id: 'trip-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    title: 'Avventura in Giappone',
    destination: 'Tokyo, Giappone',
    cover_image: null,
    start_date: '2025-04-01',
    end_date: '2025-04-15',
    status: 'planning',
    description: null,
    owner_id: 'user-1',
    budget_eur: null,
    members: [],
    days: [],
    restaurants: [],
    activities: [],
    documents: [],
    media_count: 0,
    expense_total_eur: 0,
    ...overrides,
});

describe('BookingsTab', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseAuth.mockReset();
        mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' } });
    });

    it('renders real booking data across all five sections', async () => {
        const flight = makeLeg();
        const transport = makeLeg({ id: 'leg-2', type: 'train', from_name: 'Milano', to_name: 'Venezia' });
        const acc = makeAcc();
        const rest = makeRestaurant();
        const activity = makeActivity();
        mockInitialFetches({ restaurants: [rest], activities: [activity], legs: [flight, transport], accommodations: [acc] });

        renderBookings(makeTrip({ restaurants: [rest], activities: [activity] }));

        expect(await screen.findByText('Roma → Tokyo')).toBeInTheDocument();
        expect(screen.getByText('Milano → Venezia')).toBeInTheDocument();
        expect(screen.getByText('Grand Hotel Plaza')).toBeInTheDocument();
        expect(screen.getByText('Trattoria da Mario')).toBeInTheDocument();
        expect(screen.getByText('Tour del Colosseo')).toBeInTheDocument();

        expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1/restaurants', {}, 'token-1');
        expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1/activities', {}, 'token-1');
        expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1/legs', {}, 'token-1');
        expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1/accommodations', {}, 'token-1');
    });

    it('adds an activity via ActivityDrawer, persisting it via apiFetch POST', async () => {
        mockInitialFetches();
        const user = userEvent.setup();

        const { container } = renderBookings(makeTrip());
        await screen.findByText('Nessuna attività aggiunta');

        await user.click(screen.getByRole('button', { name: /^attività$/i }));
        expect(screen.getByText('Nuova attività')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('es. Tour del Colosseo'), 'Museo Egizio');
        // duration_min is `z.coerce.number().int().min(1)` with no default (pre-existing
        // quirk ported verbatim from the old ActivityDrawer): an empty input coerces "" to
        // 0 and silently fails validation with no visible error, so it must be filled in.
        await user.type(screen.getByPlaceholderText('es. 120'), '90');

        mockApiFetch.mockResolvedValueOnce({ id: 'activity-2' }); // POST /activities
        mockApiFetch.mockResolvedValueOnce([makeActivity({ id: 'activity-2', name: 'Museo Egizio' })]); // refetch

        await user.click(getDrawerSubmitButton(container));

        await waitFor(() => {
            const postCall = mockApiFetch.mock.calls.find((c) => c[0] === '/api/trips/trip-1/activities' && (c[1] as RequestInit)?.method === 'POST');
            expect(postCall).toBeTruthy();
            const body = JSON.parse((postCall![1] as RequestInit).body as string);
            expect(body.name).toBe('Museo Egizio');
            expect(body.duration_min).toBe(90);
        });
        await waitFor(() => expect(screen.queryByText('Nuova attività')).not.toBeInTheDocument());
    });

    it('adds a restaurant booking via RestaurantDrawer, persisting it via apiFetch POST', async () => {
        mockInitialFetches();
        const user = userEvent.setup();

        const { container } = renderBookings(makeTrip());
        await screen.findByText('Nessun ristorante aggiunto');

        await user.click(screen.getByRole('button', { name: /^ristorante$/i }));
        expect(screen.getByText('Nuovo ristorante')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('es. Trattoria da Mario'), 'Osteria del Borgo');

        mockApiFetch.mockResolvedValueOnce({ id: 'rest-2' }); // POST /restaurants
        mockApiFetch.mockResolvedValueOnce([makeRestaurant({ id: 'rest-2', name: 'Osteria del Borgo' })]); // refetch

        await user.click(getDrawerSubmitButton(container));

        await waitFor(() => {
            const postCall = mockApiFetch.mock.calls.find((c) => c[0] === '/api/trips/trip-1/restaurants' && (c[1] as RequestInit)?.method === 'POST');
            expect(postCall).toBeTruthy();
            const body = JSON.parse((postCall![1] as RequestInit).body as string);
            expect(body.name).toBe('Osteria del Borgo');
        });
        await waitFor(() => expect(screen.queryByText('Nuovo ristorante')).not.toBeInTheDocument());
    });

    it('resets the RestaurantDrawer loading state after a failed save instead of getting stuck', async () => {
        mockInitialFetches();
        const user = userEvent.setup();

        const { container } = renderBookings(makeTrip());
        await screen.findByText('Nessun ristorante aggiunto');

        await user.click(screen.getByRole('button', { name: /^ristorante$/i }));
        await user.type(screen.getByPlaceholderText('es. Trattoria da Mario'), 'Osteria del Borgo');

        mockApiFetch.mockRejectedValueOnce(new Error('network error')); // failed POST /restaurants

        await user.click(getDrawerSubmitButton(container));

        // The submit button must return to its normal, enabled label instead of staying
        // stuck on the spinner/"Salvataggio..." state forever.
        await waitFor(() => expect(getDrawerSubmitButton(container)).not.toBeDisabled());
        // The drawer stays open (the save did not silently "succeed") and shows the error.
        expect(screen.getByText('Nuovo ristorante')).toBeInTheDocument();
        expect(screen.getByText('network error')).toBeInTheDocument();
    });
});
