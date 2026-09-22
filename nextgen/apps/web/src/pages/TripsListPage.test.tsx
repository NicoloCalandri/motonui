import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TripsListPage } from './TripsListPage';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderTripsList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/trips']}>
        <TripsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const makeTrip = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'trip-1',
  title: 'Viaggio di Test',
  destination: 'Parigi',
  status: 'active',
  cover_image: null,
  start_date: '2025-01-01',
  end_date: null,
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

describe('TripsListPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authValue());
  });

  it('shows a loading state while trips are being fetched', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    renderTripsList();

    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it('renders the empty state when the user has no (non-archived) trips', async () => {
    mockApiFetch.mockResolvedValueOnce([]);

    renderTripsList();

    await waitFor(() => expect(screen.getByText(/ancora nessun viaggio/i)).toBeInTheDocument());
    expect(screen.getByText(/crea il tuo primo viaggio/i)).toBeInTheDocument();
  });

  it('renders trip cards for non-archived trips and excludes archived ones', async () => {
    mockApiFetch.mockResolvedValueOnce([
      makeTrip({ id: 'trip-1', title: 'Viaggio di Test', destination: 'Parigi', status: 'active' }),
      makeTrip({ id: 'trip-2', title: 'Weekend a Roma', destination: 'Roma', status: 'completed' }),
      makeTrip({ id: 'trip-3', title: 'Vecchio Viaggio', destination: 'Milano', status: 'archived' }),
    ]);

    renderTripsList();

    await waitFor(() => expect(screen.getByText('Viaggio di Test')).toBeInTheDocument());
    expect(screen.getByText('Weekend a Roma')).toBeInTheDocument();
    expect(screen.queryByText('Vecchio Viaggio')).not.toBeInTheDocument();

    // Header and CTA both render.
    expect(screen.getByText(/i vostri viaggi/i)).toBeInTheDocument();
    expect(screen.getByText(/crea nuovo viaggio/i)).toBeInTheDocument();
  });

  it('renders the "in corso" badge for active trips and "completato" for others', async () => {
    mockApiFetch.mockResolvedValueOnce([
      makeTrip({ id: 'trip-1', title: 'Trip Attivo', status: 'active' }),
      makeTrip({ id: 'trip-2', title: 'Trip Finito', status: 'completed' }),
    ]);

    renderTripsList();

    await waitFor(() => expect(screen.getByText(/in corso/i)).toBeInTheDocument());
    expect(screen.getByText(/completato/i)).toBeInTheDocument();
  });
});
