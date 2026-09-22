import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const mockSignInWithPassword = vi.fn();

vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
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
});

describe('LoginPage', () => {
  it('renders the email/password form and dev bypass button, with no Google OAuth button', () => {
    renderLogin();

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    // import.meta.env.DEV is true under vitest, so the dev bypass footer renders.
    expect(screen.getByRole('button', { name: /log in as test@example.com/i })).toBeInTheDocument();
    // The old app never actually rendered a Google OAuth button (handleGoogle
    // was dead code there) — this port intentionally has none either.
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
  });

  it('signs in with email/password and navigates to the default redirect on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' });
  });

  it('honors the redirect query param on successful login', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin('/auth/login?redirect=%2Ftrips');

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('trips page')).toBeInTheDocument());
  });

  it('shows an error message when signInWithPassword fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
    expect(screen.queryByText('dashboard page')).not.toBeInTheDocument();
  });

  it('logs in as the dev test user when the dev bypass button is clicked', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /log in as test@example.com/i }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' });
  });
});
