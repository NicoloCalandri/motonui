import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/login" element={<span>login page</span>} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<span>dashboard</span>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

it('redirects to /auth/login when there is no user', () => {
  mockUseAuth.mockReturnValue({ user: null, isLoading: false });
  renderAt('/dashboard');
  expect(screen.getByText('login page')).toBeInTheDocument();
});

it('renders the protected route when authenticated', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false });
  renderAt('/dashboard');
  expect(screen.getByText('dashboard')).toBeInTheDocument();
});
