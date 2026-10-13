import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ForgotPasswordPage } from './ForgotPasswordPage';

const mockResetPasswordForEmail = vi.fn();

vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/forgot-password']}>
      <Routes>
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/login" element={<span>login page</span>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockResetPasswordForEmail.mockReset();
});

describe('ForgotPasswordPage', () => {
  it('renders the email form and a link back to login', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Inserisci la tua email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /torna al login/i })).toHaveAttribute('href', '/auth/login');
  });

  it('shows a confirmation message after a successful reset request', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Inserisci la tua email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    await waitFor(() => expect(screen.getByText('Controlla la tua email')).toBeInTheDocument());
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: `${window.location.origin}/auth/reset-password` }
    );
  });

  it('shows an error message when the reset request fails', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'email rate limit exceeded for nope@example.com', code: 'over_email_send_rate_limit' } });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Inserisci la tua email'), {
      target: { value: 'nope@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invia il link' }));

    await waitFor(() => expect(screen.getByText(/ti abbiamo già scritto da poco/i)).toBeInTheDocument());
    expect(screen.queryByText(/rate limit exceeded/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Controlla la tua email')).not.toBeInTheDocument();
  });
});
