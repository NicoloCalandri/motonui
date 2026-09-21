import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './AppShell';

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({ useAuth: () => mockUseAuth() }));

function renderShell(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<span>dashboard content</span>} />
          <Route path="/trips" element={<span>trips content</span>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AppShell', () => {
  it('renders nav items and the routed child content via Outlet', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'nicolo@example.com' },
      profile: { display_name: 'Nicolo', avatar_url: null },
      isLoading: false,
      profileLoading: false,
      signOut: vi.fn(),
    });

    renderShell('/dashboard');

    // Outlet renders the matched child route's content.
    expect(screen.getByText('dashboard content')).toBeInTheDocument();

    // Nav items appear (desktop sidebar titles + mobile bottom-nav labels
    // both render "Home"/"Viaggi"/"Blog"/"Impostazioni", so use getAllByText).
    expect(screen.getAllByText('Viaggi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blog').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Impostazioni').length).toBeGreaterThan(0);

    // User menu trigger shows the display name from profile.
    expect(screen.getByText('Nicolo')).toBeInTheDocument();
  });

  it('falls back to the email prefix when there is no profile display_name', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'traveler@example.com' },
      profile: null,
      isLoading: false,
      profileLoading: true,
      signOut: vi.fn(),
    });

    renderShell('/trips');

    expect(screen.getByText('trips content')).toBeInTheDocument();
    expect(screen.getByText('traveler')).toBeInTheDocument();
  });
});
