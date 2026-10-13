import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { TripDetailPage } from './TripDetailPage';
import type { TripStats } from '@motonui/shared-types';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));
// The media tab uploads straight to storage with the browser client.
vi.mock('../lib/supabase-client', () => ({ supabase: { storage: { from: vi.fn() }, auth: { getSession: vi.fn() } } }));

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

// TripMap (rendered by the real OverviewTab, now wired into the 'overview'
// tab) dynamically imports mapbox-gl and drives WebGL/canvas APIs jsdom
// doesn't provide. OverviewTab's own tests (components/trip/OverviewTab.test.tsx)
// exercise it directly with the same stub; here it's irrelevant to what
// this file is testing (shell/tab-switching), so it's stubbed out.
vi.mock('../components/map/TripMap', () => ({
  default: () => <div data-testid="trip-map" />,
}));

function renderTripDetail(initialPath = '/trips/trip-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/trips/:id" element={<TripDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const makeTrip = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'trip-1',
  title: 'Avventura in Giappone',
  destination: 'Tokyo, Giappone',
  status: 'active',
  cover_image: null,
  start_date: '2025-04-01',
  end_date: '2025-04-15',
  members: [{ id: 'm1', user_id: 'user-1', role: 'owner' }],
  days: [],
  ...overrides,
});

const makeStats = (overrides: Partial<TripStats> = {}): TripStats => ({
  total_days: 12,
  unconverted_expenses: 0,
  total_km_traveled: 3450,
  countries_visited: ['Giappone'],
  total_spent_eur: 1800,
  avg_per_day_eur: 150,
  transport_breakdown: { flight: 3000, train: 450, car: 0, ferry: 0, walk: 0, bus: 0, other: 0 },
  budget_eur: 2000,
  ...overrides,
});

const authValue = (overrides: Partial<Record<string, unknown>> = {}) => ({
  user: { id: 'user-1', email: 'sara@example.com' },
  profile: { display_name: null },
  session: { access_token: 'token-1' },
  isLoading: false,
  profileLoading: false,
  signOut: vi.fn(),
  ...overrides,
});

const TAB_LABELS = [
  'Panoramica',
  'Itinerario',
  'Prenotazioni',
  'Wallet',
  'Calendario',
  'Bagagli',
  'Spese',
  'Foto',
  'Blog',
];

describe('TripDetailPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authValue());
    // The tabs copied from the Next.js app read the API with plain fetch.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  });

  it('shows a loading state while the trip is being fetched', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    renderTripDetail();

    expect(screen.getByText(/caricamento viaggio/i)).toBeInTheDocument();
  });

  it('renders the "not found" state when the trip fetch fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('not found'));

    renderTripDetail();

    await waitFor(() => expect(screen.getByText(/viaggio non trovato/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /torna alla home/i })).toHaveAttribute('href', '/dashboard');
  });

  it('renders the hero with trip data once loaded', async () => {
    mockApiFetch.mockResolvedValueOnce(makeTrip()); // trip
    mockApiFetch.mockResolvedValueOnce(makeStats()); // OverviewTab's stats call (default tab)

    renderTripDetail();

    await waitFor(() => expect(screen.getByText('Avventura in Giappone')).toBeInTheDocument());
    // "Tokyo, Giappone" now appears twice: once in the hero, once in the
    // real OverviewTab (which renders by default) — both are expected.
    expect(screen.getAllByText('Tokyo, Giappone').length).toBeGreaterThanOrEqual(1);
    // Same reasoning: the hero and OverviewTab's editable date range use the
    // same "d MMM – d MMM yyyy" format, so this text also appears twice.
    expect(screen.getAllByText(/1 apr – 15 apr 2025/i).length).toBeGreaterThanOrEqual(1);
    expect(mockApiFetch).toHaveBeenNthCalledWith(1, '/api/trips/trip-1', {}, 'token-1');
  });

  it('renders all 9 tabs, defaults to the real Overview tab, and switches placeholders on click', async () => {
    mockApiFetch.mockResolvedValueOnce(makeTrip()); // trip
    mockApiFetch.mockResolvedValueOnce(makeStats()); // OverviewTab's stats call (default tab)
    const user = userEvent.setup();

    renderTripDetail();

    await waitFor(() => expect(screen.getByText('Avventura in Giappone')).toBeInTheDocument());

    for (const label of TAB_LABELS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument();
    }

    // Overview (Task 4.9.1) now renders its real content by default, not a placeholder.
    expect(screen.getByText('Nessuno spostamento aggiunto')).toBeInTheDocument();
    expect(screen.queryByText(/Tab in arrivo/)).not.toBeInTheDocument();

    // Bookings (Task 4.9.3) now renders its real content too, not a placeholder.
    // Mounting the real BookingsTab fires its four list GETs (restaurants,
    // activities, legs, accommodations), in that order.
    mockApiFetch.mockResolvedValueOnce([]); // restaurants
    mockApiFetch.mockResolvedValueOnce([]); // activities
    mockApiFetch.mockResolvedValueOnce([]); // legs
    mockApiFetch.mockResolvedValueOnce([]); // accommodations

    await user.click(screen.getByRole('button', { name: /prenotazioni/i }));
    expect(await screen.findByText('Nessun volo aggiunto')).toBeInTheDocument();
    expect(screen.queryByText(/Tab in arrivo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nessuno spostamento aggiunto')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^blog$/i }));
    expect(await screen.findByText('Nessun post ancora')).toBeInTheDocument();
    expect(screen.queryByText(/Tab in arrivo/)).not.toBeInTheDocument();
  });

  it('respects the initial ?tab= query param for the default active tab', async () => {
    mockApiFetch.mockResolvedValueOnce(makeTrip());

    renderTripDetail('/trips/trip-1?tab=blog');

    await waitFor(() => expect(screen.getByText('Nessun post ancora')).toBeInTheDocument());
  });

  describe('members', () => {
    // GET /api/trips/:id returns the members under `trip_members`.
    const withMembers = (count: number) => makeTrip({
      members: undefined,
      trip_members: Array.from({ length: count }, (_value, index) => ({ id: `m${index}`, user_id: `user-${index}`, role: index === 0 ? 'owner' : 'member' })),
    });
    const show = async (count: number) => {
      mockApiFetch.mockImplementation((path: string) => Promise.resolve(path === '/api/trips/trip-1' ? withMembers(count) : {}));
      renderTripDetail();
      await waitFor(() => expect(screen.getByText('Avventura in Giappone')).toBeInTheDocument());
    };

    it('counts one traveller and offers to invite the partner', async () => {
      await show(1);

      expect(screen.getByText('1 persona')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Invita il tuo partner' })).toBeInTheDocument();
    });

    it('counts two travellers and offers no invite', async () => {
      await show(2);

      expect(screen.getByText('2 persone')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Invita il tuo partner' })).not.toBeInTheDocument();
    });
  });
});
