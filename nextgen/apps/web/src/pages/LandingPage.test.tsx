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

    expect(screen.getByText(/viaggio perfetto/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accedi / Registrati' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inizia ora con google/i })).toBeInTheDocument();
  });

  it('renders the four feature cards', () => {
    renderLanding();

    expect(screen.getByText('Itinerario')).toBeInTheDocument();
    expect(screen.getByText('Spese condivise')).toBeInTheDocument();
    expect(screen.getByText('Prenotazioni')).toBeInTheDocument();
    expect(screen.getByText('Diario AI')).toBeInTheDocument();
  });

  it('calls signInWithOAuth with the google provider when the header button is clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: 'Accedi / Registrati' }));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalled());
    const [args] = mockSignInWithOAuth.mock.calls[0];
    expect(args.provider).toBe('google');
    expect(args.options.redirectTo).toContain('/auth/callback?redirect=/dashboard');
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

    fireEvent.click(screen.getByRole('button', { name: 'Accedi / Registrati' }));

    await waitFor(() => expect(screen.getByText('Errore con Google. Riprova.')).toBeInTheDocument());
  });
});
