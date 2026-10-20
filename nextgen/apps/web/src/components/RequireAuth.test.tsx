import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth, RedirectIfAuthenticated, RequireAdmin, RequireNotSuspended } from './RequireAuth';

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderAt(path: string, routesConfig?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routesConfig || (
          <>
            <Route path="/auth/login" element={<span>login page</span>} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<span>dashboard</span>} />
            </Route>
          </>
        )}
      </Routes>
    </MemoryRouter>
  );
}

it('redirects to /auth/login when there is no user', () => {
  mockUseAuth.mockReturnValue({ user: null, isLoading: false, profileLoading: false });
  renderAt('/dashboard');
  expect(screen.getByText('login page')).toBeInTheDocument();
});

it('renders the protected route when authenticated', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false, profileLoading: false });
  renderAt('/dashboard');
  expect(screen.getByText('dashboard')).toBeInTheDocument();
});

it('redirects authenticated users away from /auth/login', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false });
  renderAt(
    '/auth/login',
    <>
      <Route path="/dashboard" element={<span>dashboard</span>} />
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/auth/login" element={<span>login page</span>} />
      </Route>
    </>
  );
  expect(screen.getByText('dashboard')).toBeInTheDocument();
});

it('redirects an authenticated user away from / to /dashboard (RequireNotSuspended > RedirectIfAuthenticated)', () => {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1' },
    isLoading: false,
    profileLoading: false,
    profile: null,
  });
  renderAt(
    '/',
    <>
      <Route path="/dashboard" element={<span>dashboard</span>} />
      <Route element={<RequireNotSuspended />}>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/" element={<span>landing page</span>} />
        </Route>
      </Route>
    </>
  );
  expect(screen.getByText('dashboard')).toBeInTheDocument();
  expect(screen.queryByText('landing page')).not.toBeInTheDocument();
});

it('renders / normally for an anonymous visitor (RequireNotSuspended > RedirectIfAuthenticated)', () => {
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    profileLoading: false,
    profile: null,
  });
  renderAt(
    '/',
    <>
      <Route path="/dashboard" element={<span>dashboard</span>} />
      <Route element={<RequireNotSuspended />}>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/" element={<span>landing page</span>} />
        </Route>
      </Route>
    </>
  );
  expect(screen.getByText('landing page')).toBeInTheDocument();
});

it('does NOT redirect RequireAdmin while profileLoading is true', () => {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1' },
    isLoading: false,
    profileLoading: true, // Still loading profile
    profile: null,
  });
  renderAt(
    '/admin',
    <>
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<span>admin panel</span>} />
      </Route>
      <Route path="/dashboard" element={<span>dashboard</span>} />
    </>
  );
  // Should render null (loading state), not redirect
  expect(screen.queryByText('admin panel')).not.toBeInTheDocument();
  expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
});
