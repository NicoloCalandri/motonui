import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OverviewTab from './OverviewTab';
import type { TripWithDetails, TripStats } from '@motonui/shared-types';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

// TripMap dynamically imports mapbox-gl and drives real WebGL/canvas APIs
// that jsdom cannot provide — stub it so OverviewTab's own logic (whether
// to render a map vs. the empty state) can be tested without touching
// Mapbox itself.
vi.mock('../map/TripMap', () => ({
  default: ({ legs }: { legs: unknown[] }) => (
    <div data-testid="trip-map">{legs.length} legs on map</div>
  ),
}));

function renderOverview(trip: TripWithDetails, props: Partial<Parameters<typeof OverviewTab>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OverviewTab trip={trip} {...props} />
    </QueryClientProvider>
  );
}

const makeStats = (overrides: Partial<TripStats> = {}): TripStats => ({
  total_days: 12,
  unconverted_expenses: 0,
  total_km_traveled: 3450,
  countries_visited: ['Giappone', 'Corea del Sud'],
  total_spent_eur: 1800,
  avg_per_day_eur: 150,
  transport_breakdown: { flight: 3000, train: 450, car: 0, ferry: 0, walk: 0, bus: 0, other: 0 },
  budget_eur: 2000,
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
  description: 'Un viaggio indimenticabile tra Tokyo e Kyoto.',
  owner_id: 'user-1',
  budget_eur: 2000,
  members: [],
  days: [],
  restaurants: [],
  activities: [],
  documents: [],
  media_count: 0,
  expense_total_eur: 0,
  ...overrides,
});

describe('OverviewTab', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' } });
  });

  it('renders without crashing and shows description, destination, and fetched stats', async () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());

    renderOverview(makeTrip());

    expect(screen.getByText('Un viaggio indimenticabile tra Tokyo e Kyoto.')).toBeInTheDocument();
    expect(screen.getByText('Tokyo, Giappone')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText((_, el) => el?.tagName === 'P' && /^3.?450 km$/.test(el.textContent ?? ''))).toBeInTheDocument()
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // countries_visited.length
    expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1/stats', {}, 'token-1');
  });

  it('shows the empty-legs state and calls onNavigate when there are no legs', () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());
    const onNavigate = vi.fn();

    renderOverview(makeTrip({ days: [] }), { onNavigate });

    expect(screen.getByText('Nessuno spostamento aggiunto')).toBeInTheDocument();
    expect(screen.queryByTestId('trip-map')).not.toBeInTheDocument();

    screen.getByRole('button', { name: /vai all'itinerario/i }).click();
    expect(onNavigate).toHaveBeenCalledWith('itinerary');
  });

  it('renders the map with the flattened legs when days have legs', () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());

    const trip = makeTrip({
      days: [
        {
          id: 'day-1',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          trip_id: 'trip-1',
          date: '2025-04-01',
          title: null,
          notes: null,
          sort_order: 0,
          legs: [
            {
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
              boarding_pass_path: null,
              checkin_opens_at: null,
              notes: null,
              sort_order: 0,
            },
          ],
          accommodations: [],
        },
      ],
    });

    renderOverview(trip);

    expect(screen.getByTestId('trip-map')).toHaveTextContent('1 legs on map');
  });

  it('shows "Nessun budget impostato" and lets the user set a budget via apiFetch PUT', async () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());
    mockApiFetch.mockResolvedValueOnce({}); // the PUT save

    const onTripUpdate = vi.fn();
    const user = userEvent.setup();

    renderOverview(makeTrip({ budget_eur: null }), { onTripUpdate });

    expect(screen.getByText('Nessun budget impostato.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /imposta/i }));
    await user.type(screen.getByPlaceholderText('0.00'), '500');
    await user.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/trips/trip-1',
        { method: 'PUT', body: JSON.stringify({ budget_eur: 500 }) },
        'token-1'
      )
    );
    expect(onTripUpdate).toHaveBeenCalledWith({ budget_eur: 500 });
    await waitFor(() => expect(screen.getByText(/€500/)).toBeInTheDocument());
  });

  it('resets the loading state after a failed budget save instead of getting stuck', async () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());
    mockApiFetch.mockRejectedValueOnce(new Error('network error')); // the failed PUT save

    const onTripUpdate = vi.fn();
    const user = userEvent.setup();

    renderOverview(makeTrip({ budget_eur: null }), { onTripUpdate });

    await user.click(screen.getByRole('button', { name: /imposta/i }));
    await user.type(screen.getByPlaceholderText('0.00'), '500');
    await user.click(screen.getByRole('button', { name: /salva/i }));

    // The Salva button must return to its normal, enabled label instead of
    // staying stuck on "…" forever after a rejected apiFetch call.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Salva' })).not.toBeDisabled();
    // The edit form stays open (the save did not silently "succeed").
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(onTripUpdate).not.toHaveBeenCalled();
  });

  it('resets the loading state after a failed dates save instead of getting stuck', async () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());
    mockApiFetch.mockRejectedValueOnce(new Error('network error')); // the failed PUT save

    const onTripUpdate = vi.fn();
    const user = userEvent.setup();

    // budget_eur: null so the budget card shows "Imposta" rather than its
    // own "Modifica" button, keeping the dates section's "Modifica" unique.
    renderOverview(makeTrip({ budget_eur: null }), { onTripUpdate });

    await user.click(screen.getByRole('button', { name: /modifica/i }));
    await user.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Salva' })).not.toBeDisabled();
    expect(onTripUpdate).not.toHaveBeenCalled();
  });

  it('renders trip members with translated roles', async () => {
    mockApiFetch.mockResolvedValueOnce(makeStats());

    renderOverview(
      makeTrip({
        members: [
          { id: 'm1', user_id: 'user-1', role: 'owner' },
          { id: 'm2', user_id: 'user-2', role: 'member' },
        ],
      })
    );

    expect(screen.getByText('Viaggiatori')).toBeInTheDocument();
    expect(screen.getByText('Proprietario')).toBeInTheDocument();
    expect(screen.getByText('Membro')).toBeInTheDocument();
  });
});
