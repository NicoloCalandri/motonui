import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const mockSignInWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

function renderLogin(path = '/auth/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<span>dashboard page</span>} />
        <Route path="/trips" element={<span>trips page</span>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockSignInWithPassword.mockReset();
  mockSignInWithOAuth.mockReset();
});

describe('LoginPage', () => {
  it('renders the form in Italian, with the Google button and the dev bypass', () => {
    renderLogin();

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeInTheDocument();
    // import.meta.env.DEV is true under vitest, so the dev bypass footer renders.
    expect(screen.getByRole('button', { name: /log in as test@example.com/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continua con Google' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /che bello rivederti/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome back|remember me/i)).not.toBeInTheDocument();
  });

  it('signs in with email/password and navigates to the default redirect on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' });
  });

  it('honors the redirect query param on successful login', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin('/auth/login?redirect=%2Ftrips');

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByText('trips page')).toBeInTheDocument());
  });

  it('shows an error message when signInWithPassword fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByText('Ops! Email o password non corrispondono. Riprova 🏝️')).toBeInTheDocument());
    expect(screen.queryByText(/invalid login credentials/i)).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard page')).not.toBeInTheDocument();
  });

  it('logs in as the dev test user when the dev bypass button is clicked', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /log in as test@example.com/i }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' });
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example'])('ignores the redirect %s', async (target) => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin(`/auth/login?redirect=${encodeURIComponent(target)}`);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'una-password-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
  });

  it('starts the Google sign-in and comes back to the requested page of this site', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    renderLogin('/auth/login?redirect=/trips');

    fireEvent.click(screen.getByRole('button', { name: 'Continua con Google' }));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/trips` } });
  });

  it('shows a friendly message when the Google sign-in cannot start', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'provider is not enabled' } });
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Continua con Google' }));

    await waitFor(() => expect(screen.getByText('Ops! L’accesso con Google non è riuscito. Riprova 🏝️')).toBeInTheDocument());
    expect(screen.queryByText(/provider is not enabled/i)).not.toBeInTheDocument();
  });
});
