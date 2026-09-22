import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResetPasswordPage } from './ResetPasswordPage';

const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/reset-password']}>
      <Routes>
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/login" element={<span>login page</span>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockUpdateUser.mockReset();
});

describe('ResetPasswordPage', () => {
  it('redirects to /auth/login when there is no recovery session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderPage();

    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
  });

  it('renders the new-password form when a session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    renderPage();

    await waitFor(() => expect(screen.getByPlaceholderText('Nuova Password')).toBeInTheDocument());
  });

  it('shows a validation error when passwords do not match', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    renderPage();

    await waitFor(() => screen.getByPlaceholderText('Nuova Password'));
    fireEvent.change(screen.getByPlaceholderText('Nuova Password'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByPlaceholderText('Conferma Nuova Password'), { target: { value: 'password2' } });
    fireEvent.click(screen.getByRole('button', { name: /reimposta password/i }));

    expect(screen.getByText('Le password non coincidono')).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('updates the password and shows a success message on match', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    mockUpdateUser.mockResolvedValue({ error: null });
    renderPage();

    await waitFor(() => screen.getByPlaceholderText('Nuova Password'));
    fireEvent.change(screen.getByPlaceholderText('Nuova Password'), { target: { value: 'newpassword1' } });
    fireEvent.change(screen.getByPlaceholderText('Conferma Nuova Password'), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /reimposta password/i }));

    await waitFor(() => expect(screen.getByText('Password Aggiornata!')).toBeInTheDocument());
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword1' });
  });
});
