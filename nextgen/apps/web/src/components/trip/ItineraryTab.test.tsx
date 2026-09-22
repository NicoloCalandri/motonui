import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItineraryTab from './ItineraryTab';
import type { TripWithDetails, Day, Leg, Accommodation, Activity } from '@motonui/shared-types';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderItinerary(trip: TripWithDetails, props: Partial<Parameters<typeof ItineraryTab>[0]> = {}) {
    return render(<ItineraryTab trip={trip} {...props} />);
}

/** DayDrawer's date input has no `htmlFor`/`id` pairing with its label, so it can't be found via getByLabelText. */
function getDayDateInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('input[name="date"]') as HTMLInputElement;
}

const makeDay = (overrides: Partial<Day> = {}): Day => ({
    id: 'day-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1',
    date: '2025-04-01',
    title: null,
    notes: null,
    sort_order: 0,
    ...overrides,
});

const makeLeg = (overrides: Partial<Leg> = {}): Leg => ({
    id: 'leg-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1',
    day_id: 'day-1',
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
    day_id: 'day-1',
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

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
    id: 'activity-1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    trip_id: 'trip-1', day_id: 'day-1', name: 'Tour del Colosseo', type: 'tour',
    address: null, lat: null, lng: null, date: '2025-04-01', time: null, duration_min: null,
    cost: null, currency: 'EUR', booking_ref: null, ticket_url: null, notes: null, sort_order: 0,
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

describe('ItineraryTab', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseAuth.mockReset();
        mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' } });
    });

    it('renders real itinerary data: a day with a leg and an accommodation', async () => {
        const day = { ...makeDay(), legs: [makeLeg()], accommodations: [makeAcc()] };
        // Initial mount fetchDays() GET call
        mockApiFetch.mockResolvedValueOnce([day]);

        renderItinerary(makeTrip({ days: [day] }));

        expect(await screen.findByText('Roma → Tokyo')).toBeInTheDocument();
        expect(screen.getByText('Grand Hotel Plaza')).toBeInTheDocument();
        expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1/days', {}, 'token-1');
    });

    it('shows the empty state and lets the user add a day, persisting it via apiFetch POST', async () => {
        mockApiFetch.mockResolvedValueOnce([]); // initial fetchDays
        const user = userEvent.setup();

        const { container } = renderItinerary(makeTrip());

        expect(await screen.findByText('Nessun giorno pianificato')).toBeInTheDocument();

        mockApiFetch.mockResolvedValueOnce({ id: 'day-1' }); // POST /days
        const newDay = { ...makeDay(), legs: [], accommodations: [] };
        mockApiFetch.mockResolvedValueOnce([newDay]); // refetch after save

        await user.click(screen.getByRole('button', { name: /aggiungi giorno/i }));
        const dateInput = getDayDateInput(container);
        await user.clear(dateInput);
        await user.type(dateInput, '2025-04-01');
        await user.click(screen.getByRole('button', { name: /aggiungi all'itinerario/i }));

        await waitFor(() =>
            expect(mockApiFetch).toHaveBeenCalledWith(
                '/api/trips/trip-1/days',
                { method: 'POST', body: JSON.stringify({ date: '2025-04-01', title: '' }) },
                'token-1'
            )
        );
        // Drawer closes and the new day renders once the refetch resolves.
        await waitFor(() => expect(screen.queryByText('Nuovo giorno')).not.toBeInTheDocument());
    });

    it('adds a flight leg to an existing day using airport and carrier search', async () => {
        const day = { ...makeDay(), legs: [], accommodations: [], activities: [] };
        mockApiFetch.mockResolvedValueOnce([day]); // initial fetchDays
        const user = userEvent.setup();

        renderItinerary(makeTrip({ days: [day] }));
        await screen.findByText('Nessuna attività pianificata');

        await user.click(screen.getByRole('button', { name: /spostamento/i }));
        expect(screen.getByText('Nuovo spostamento')).toBeInTheDocument();

        // Airport search (flight is the default selected type) — pick "Da"/"A".
        const fromInput = screen.getByPlaceholderText('Da — codice IATA o città');
        await user.type(fromInput, 'TRN');
        await user.click(await screen.findByText('Torino'));

        const toInput = screen.getByPlaceholderText('A — codice IATA o città');
        await user.type(toInput, 'FCO');
        await user.click(await screen.findByText('Roma'));

        // Carrier search
        const carrierInput = screen.getByPlaceholderText('es. Ryanair');
        await user.type(carrierInput, 'ITA');
        await user.click(await screen.findByText('ITA Airways'));

        mockApiFetch.mockResolvedValueOnce({ id: 'leg-1' }); // POST /legs
        mockApiFetch.mockResolvedValueOnce([{ ...day, legs: [makeLeg()] }]); // refetch

        await user.click(screen.getByRole('button', { name: /^aggiungi spostamento$/i }));

        await waitFor(() => {
            const postCall = mockApiFetch.mock.calls.find(
                (c) => c[0] === '/api/trips/trip-1/days/day-1/legs'
            );
            expect(postCall).toBeTruthy();
            const body = JSON.parse((postCall![1] as RequestInit).body as string);
            expect(body.from_name).toBe('TRN — Torino');
            expect(body.to_name).toBe('FCO — Roma');
            expect(body.carrier).toBe('ITA Airways');
            expect(body.type).toBe('flight');
        });
    });

    it('adds an accommodation to an existing day, persisting it via apiFetch POST', async () => {
        const day = { ...makeDay(), legs: [], accommodations: [], activities: [] };
        mockApiFetch.mockResolvedValueOnce([day]); // initial fetchDays
        const user = userEvent.setup();

        renderItinerary(makeTrip({ days: [day] }));
        await screen.findByText('Nessuna attività pianificata');

        await user.click(screen.getByRole('button', { name: /alloggio/i }));
        expect(screen.getByText('Nuovo alloggio')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('es. Grand Hotel Plaza'), 'Hotel Test');

        mockApiFetch.mockResolvedValueOnce({ id: 'acc-1' }); // POST /accommodations
        mockApiFetch.mockResolvedValueOnce([{ ...day, accommodations: [makeAcc()] }]); // refetch

        await user.click(screen.getByRole('button', { name: /^aggiungi alloggio$/i }));

        await waitFor(() => {
            const postCall = mockApiFetch.mock.calls.find(
                (c) => c[0] === '/api/trips/trip-1/days/day-1/accommodations'
            );
            expect(postCall).toBeTruthy();
            const body = JSON.parse((postCall![1] as RequestInit).body as string);
            expect(body.name).toBe('Hotel Test');
        });
    });

    it('renders an existing activity and adds a new one via ActivityDrawer, persisting it via apiFetch POST', async () => {
        const day = { ...makeDay(), legs: [], accommodations: [], activities: [makeActivity()] };
        mockApiFetch.mockResolvedValueOnce([day]); // initial fetchDays
        const user = userEvent.setup();

        renderItinerary(makeTrip({ days: [day] }));
        expect(await screen.findByText('Tour del Colosseo')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /^attività$/i }));
        expect(screen.getByText('Nuova attività')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('es. Tour del Colosseo'), 'Museo Egizio');
        // duration_min: z.coerce.number().min(1) has no default, so "" (empty) -> 0 fails
        // validation silently (pre-existing ActivityDrawer quirk) — must be filled in.
        await user.type(screen.getByPlaceholderText('es. 120'), '90');

        mockApiFetch.mockResolvedValueOnce({ id: 'activity-2' }); // POST /activities
        mockApiFetch.mockResolvedValueOnce([{ ...day, activities: [makeActivity(), makeActivity({ id: 'activity-2', name: 'Museo Egizio' })] }]); // refetch

        await user.click(screen.getByRole('button', { name: /^aggiungi attività$/i }));

        await waitFor(() => {
            const postCall = mockApiFetch.mock.calls.find(
                (c) => c[0] === '/api/trips/trip-1/activities'
            );
            expect(postCall).toBeTruthy();
            const body = JSON.parse((postCall![1] as RequestInit).body as string);
            expect(body.name).toBe('Museo Egizio');
            expect(body.day_id).toBe('day-1');
        });
    });

    it('resets the DayDrawer loading state after a failed save instead of getting stuck', async () => {
        mockApiFetch.mockResolvedValueOnce([]); // initial fetchDays
        const user = userEvent.setup();

        const { container } = renderItinerary(makeTrip());
        await screen.findByText('Nessun giorno pianificato');

        mockApiFetch.mockRejectedValueOnce(new Error('network error')); // failed POST /days

        await user.click(screen.getByRole('button', { name: /aggiungi giorno/i }));
        const dateInput = getDayDateInput(container);
        await user.clear(dateInput);
        await user.type(dateInput, '2025-04-01');
        await user.click(screen.getByRole('button', { name: /aggiungi all'itinerario/i }));

        // The submit button must return to its normal, enabled label instead of
        // staying stuck on the spinner/"Salvataggio..." state forever.
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /aggiungi all'itinerario/i })).not.toBeDisabled()
        );
        // The drawer stays open (the save did not silently "succeed") and shows the error.
        expect(screen.getByText('Nuovo giorno')).toBeInTheDocument();
        expect(screen.getByText('network error')).toBeInTheDocument();
    });
});
