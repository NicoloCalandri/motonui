import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './DashboardPage';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const makeTrip = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'trip-1',
  title: 'Viaggio di Test',
  destination: 'Tokyo, Giappone',
  status: 'active',
  cover_image: null,
  start_date: '2025-04-01',
  end_date: '2025-04-15',
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

describe('DashboardPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockUseAuth.mockReset();
  });

  it('shows a loading state while trips are being fetched', () => {
    mockUseAuth.mockReturnValue(authValue());
    // Never resolves within this test — captures the loading render.
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it('renders the empty state and zero trip count when the user has no trips', async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockApiFetch.mockResolvedValueOnce([]);

    renderDashboard();

    await waitFor(() => expect(screen.getByText(/pronti per una nuova avventura/i)).toBeInTheDocument());
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/nessun viaggio attivo/i)).toBeInTheDocument();
    expect(screen.getByText(/ciao sara/i)).toBeInTheDocument();
  });

  it('renders the active trip hero, trip count, past trips, and budget from trip stats', async () => {
    mockUseAuth.mockReturnValue(authValue({ profile: { display_name: 'Nicolo' } }));
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/trips') {
        return Promise.resolve([
          makeTrip({ id: 'trip-1', title: 'Avventura in Giappone', status: 'active' }),
          makeTrip({ id: 'trip-2', title: 'Weekend a Roma', destination: 'Roma, Italia', status: 'completed' }),
        ]);
      }
      if (path === '/api/trips/trip-1/stats') {
        return Promise.resolve({
          total_days: 10,
          total_km_traveled: 100,
          countries_visited: ['Giappone'],
          total_spent_eur: 450,
          avg_per_day_eur: 45,
          transport_breakdown: {},
          budget_eur: 1000,
        });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Avventura in Giappone')).toBeInTheDocument());
    expect(screen.getByText('Ciao Nicolo')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Viaggi totali
    expect(screen.getByText('Weekend a Roma')).toBeInTheDocument(); // past trip card
    await waitFor(() => expect(screen.getByText('€450')).toBeInTheDocument());
    // Grouping separator rendering (1.000 vs 1000) depends on the ICU data
    // available in the test runtime, so match loosely on the digits/label.
    expect(
      screen.getByText((_, element) => element?.tagName === 'P' && /su €1.?000 budget/.test(element.textContent ?? ''))
    ).toBeInTheDocument();
  });

  it('shows the "Imposta un budget" hint when the active trip has no budget set', async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/trips') {
        return Promise.resolve([makeTrip({ status: 'active' })]);
      }
      if (path === '/api/trips/trip-1/stats') {
        return Promise.resolve({
          total_days: 1,
          total_km_traveled: 0,
          countries_visited: [],
          total_spent_eur: 0,
          avg_per_day_eur: 0,
          transport_breakdown: {},
          budget_eur: null,
        });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText(/imposta un budget/i)).toBeInTheDocument());
  });
});
