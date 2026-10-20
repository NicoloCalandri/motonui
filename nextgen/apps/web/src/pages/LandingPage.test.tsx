import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

const mockSignInWithOAuth = vi.fn();

vi.mock('../lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LandingPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockSignInWithOAuth.mockReset();
});

describe('LandingPage', () => {
  it('renders the hero copy and both Google sign-in buttons', () => {
    renderLanding();

    expect(screen.getByText(/pianificato in due/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accedi qui' })).toHaveAttribute('href', '/auth/login');
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('button', { name: 'Entra con Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inizia ora con google/i })).toBeInTheDocument();
  });

  it('renders the four feature cards', () => {
    renderLanding();

    expect(screen.getByText('Itinerario')).toBeInTheDocument();
    expect(screen.getByText('Spese condivise')).toBeInTheDocument();
    expect(screen.getByText('Prenotazioni')).toBeInTheDocument();
    expect(screen.getByText('Diario e Instagram')).toBeInTheDocument();
  });

  it('calls signInWithOAuth with the google provider when the header button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: 'Entra con Google' }));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalled());
    const [args] = mockSignInWithOAuth.mock.calls[0];
    expect(args.provider).toBe('google');
    // No server callback in the SPA: the browser client reads the session from the URL it lands on.
    expect(args.options.redirectTo).toBe(`${window.location.origin}/dashboard`);
  });

  it('calls signInWithOAuth with the google provider when the hero button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /inizia ora con google/i }));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalled());
  });

  it('shows an error message when signInWithOAuth fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'oauth failed' } });
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: 'Entra con Google' }));

    await waitFor(() => expect(screen.getByText('Ops! L’accesso con Google non è riuscito. Riprova 🏝️')).toBeInTheDocument());
    expect(screen.queryByText(/oauth failed/i)).not.toBeInTheDocument();
  });
});
