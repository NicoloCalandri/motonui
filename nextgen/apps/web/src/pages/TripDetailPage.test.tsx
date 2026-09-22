import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { TripDetailPage } from './TripDetailPage';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

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
    mockApiFetch.mockResolvedValueOnce(makeTrip());

    renderTripDetail();

    await waitFor(() => expect(screen.getByText('Avventura in Giappone')).toBeInTheDocument());
    expect(screen.getByText('Tokyo, Giappone')).toBeInTheDocument();
    expect(screen.getByText(/1 apr – 15 apr 2025/i)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/trips/trip-1', {}, 'token-1');
  });

  it('renders all 9 tabs, defaults to the overview placeholder, and switches on click', async () => {
    mockApiFetch.mockResolvedValueOnce(makeTrip());
    const user = userEvent.setup();

    renderTripDetail();

    await waitFor(() => expect(screen.getByText('Avventura in Giappone')).toBeInTheDocument());

    for (const label of TAB_LABELS) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }

    expect(screen.getByText('Tab in arrivo — Task 4.9.1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /prenotazioni/i }));
    expect(screen.getByText('Tab in arrivo — Task 4.9.3')).toBeInTheDocument();
    expect(screen.queryByText('Tab in arrivo — Task 4.9.1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^blog$/i }));
    expect(screen.getByText('Tab in arrivo — Task 4.9.9')).toBeInTheDocument();
  });

  it('respects the initial ?tab= query param for the default active tab', async () => {
    mockApiFetch.mockResolvedValueOnce(makeTrip());

    renderTripDetail('/trips/trip-1?tab=wallet');

    await waitFor(() => expect(screen.getByText('Tab in arrivo — Task 4.9.4')).toBeInTheDocument());
  });
});
