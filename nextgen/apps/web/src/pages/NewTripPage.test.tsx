import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewTripPage } from './NewTripPage';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderNewTrip() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/trips/new']}>
        <NewTripPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function fillStep1AndContinue(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/giappone 2025/i), 'Giappone 2025');
  await user.type(screen.getByPlaceholderText(/dove volete andare/i), 'Tokyo');
  await user.click(screen.getByRole('button', { name: /continua/i }));
  await waitFor(() => expect(screen.getByText(/lo farò più tardi/i)).toBeInTheDocument());
}

describe('NewTripPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockUseAuth.mockReset();
    mockNavigate.mockReset();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'sara@example.com' },
      profile: { display_name: null },
      session: { access_token: 'token-1' },
      isLoading: false,
      profileLoading: false,
      signOut: vi.fn(),
    });
  });

  it('renders the step 1 form', () => {
    renderNewTrip();
    expect(screen.getByText(/nuovo viaggio/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/giappone 2025/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/dove volete andare/i)).toBeInTheDocument();
  });

  it('shows a validation error when submitting step 1 without a title or destination', async () => {
    const user = userEvent.setup();
    renderNewTrip();

    await user.click(screen.getByRole('button', { name: /continua/i }));

    await waitFor(() => {
      expect(screen.getByText(/inserisci un nome per il viaggio/i)).toBeInTheDocument();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('advances to step 2 after a valid step 1 submission', async () => {
    const user = userEvent.setup();
    renderNewTrip();
    await fillStep1AndContinue(user);

    expect(screen.getByText(/con chi viaggi/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/partner@example.com/i)).toBeInTheDocument();
  });

  it('submits the trip via apiFetch with the step 1 payload and navigates to the new trip on success', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/trips') {
        return Promise.resolve({ id: 'trip-99', title: 'Giappone 2025', destination: 'Tokyo' });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    const user = userEvent.setup();
    renderNewTrip();
    await fillStep1AndContinue(user);

    // "Lo farò più tardi" skips the (optional, empty) partner email and
    // submits step 2 directly — matches the old page's behavior exactly.
    await user.click(screen.getByText(/lo farò più tardi/i));

    await waitFor(() => expect(screen.getByText(/viaggio creato/i)).toBeInTheDocument());

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const [path, init, token] = mockApiFetch.mock.calls[0];
    expect(path).toBe('/api/trips');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      title: 'Giappone 2025',
      destination: 'Tokyo',
      start_date: '',
      end_date: '',
      description: '',
    });
    expect(token).toBe('token-1');

    // The redirect fires after a short success-screen delay (real timer).
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/trips/trip-99'), { timeout: 3000 });
  });

  it('shows an API error message when trip creation fails', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/trips') {
        return Promise.reject(new Error('Errore server'));
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    const user = userEvent.setup();
    renderNewTrip();
    await fillStep1AndContinue(user);
    await user.click(screen.getByText(/lo farò più tardi/i));

    await waitFor(() => {
      expect(screen.getByText('Errore server')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
