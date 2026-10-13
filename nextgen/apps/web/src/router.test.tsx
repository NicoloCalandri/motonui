import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('./lib/auth-context', () => ({ useAuth: () => auth.value }));
vi.mock('./lib/api-client', () => ({ apiFetch: vi.fn().mockResolvedValue([]) }));
vi.mock('./lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'recovery' } } }),
      updateUser: vi.fn(),
    },
  },
}));

import { router } from './router';

function open(path: string) {
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={memory} />
    </QueryClientProvider>
  );
  return memory;
}

const signedIn = {
  user: { id: 'user-1', email: 'giorgia@example.com' },
  profile: { role: 'user', suspended_at: null, display_name: 'Giorgia' },
  session: { access_token: 'token-1' },
  isLoading: false,
  profileLoading: false,
  signOut: vi.fn(),
};
const signedOut = { ...signedIn, user: null, profile: null, session: null };

describe('router', () => {
  beforeEach(() => {
    auth.value = signedIn;
  });

  it('lets a recovery session reach the reset-password page', async () => {
    // The link in the reset email signs the user in: bouncing a signed-in
    // user to the dashboard would make the password impossible to reset.
    const memory = open('/auth/reset-password');

    await waitFor(() => expect(screen.getByPlaceholderText('Nuova Password')).toBeInTheDocument());
    expect(memory.state.location.pathname).toBe('/auth/reset-password');
  });

  it('sends a signed-in user away from the login page', async () => {
    const memory = open('/auth/login');

    await waitFor(() => expect(memory.state.location.pathname).toBe('/dashboard'));
  });

  it('sends a signed-out user to the login page, remembering where they were going', async () => {
    auth.value = signedOut;

    const memory = open('/trips');

    await waitFor(() => expect(memory.state.location.pathname).toBe('/auth/login'));
    expect(memory.state.location.search).toBe('?redirect=%2Ftrips');
  });

  it('sends a suspended user to the page that says so, from anywhere in the app', async () => {
    auth.value = { ...signedIn, profile: { ...signedIn.profile, suspended_at: '2026-10-01T00:00:00Z', suspended_reason: 'Verifica in corso' } };

    const memory = open('/trips');

    await waitFor(() => expect(memory.state.location.pathname).toBe('/suspended'));
    expect(await screen.findByRole('heading', { name: 'Il tuo account è in pausa' })).toBeInTheDocument();
    expect(screen.getByText('Verifica in corso')).toBeInTheDocument();
  });

  it('keeps a user who is not an admin out of the admin area', async () => {
    const memory = open('/admin');

    await waitFor(() => expect(memory.state.location.pathname).toBe('/dashboard'));
  });

  it('opens the post editor on a new post', async () => {
    open('/trips/10000000-0000-4000-8000-00000000000a/posts/new/edit');

    expect(await screen.findByPlaceholderText('Titolo del post...')).toBeInTheDocument();
  });

  it('shows the public blog without a session', async () => {
    auth.value = signedOut;

    const memory = open('/blog');

    expect(await screen.findByRole('heading', { name: 'Il nostro diario di viaggio' })).toBeInTheDocument();
    expect(memory.state.location.pathname).toBe('/blog');
  });
});
