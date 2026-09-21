import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Use vi.hoisted to make mocks available
const { mockGetSession, mockOnAuthStateChange, mockSignOut, mockApiFetch } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockApiFetch: vi.fn(),
}));

vi.mock('./supabase-client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  },
}));

vi.mock('./api-client', () => ({
  apiFetch: mockApiFetch,
}));

import { AuthProvider, useAuth } from './auth-context';

afterEach(() => {
  vi.clearAllMocks();
});

function Probe() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <span>loading</span>;
  return <span>{user ? `user:${user.id}` : 'anon'}</span>;
}

function ProfileProbe() {
  const { profile, isLoading } = useAuth();
  if (isLoading) return <span>loading</span>;
  return <span>{profile ? `profile:${profile.id}` : 'no-profile'}</span>;
}

function SignOutProbe() {
  const { user, signOut } = useAuth();
  if (!user) return <span>anon</span>;
  return <button onClick={signOut}>sign out</button>;
}

it('resolves the initial session on mount', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockResolvedValueOnce({ id: 'profile1', email: 'user@test.com' });

  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('user:u1')).toBeInTheDocument());
});

it('renders as anonymous when getSession resolves with null', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });

  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
});

it('sets isLoading to false when getSession rejects', async () => {
  mockGetSession.mockRejectedValueOnce(new Error('Network error'));
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });

  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
});

it('calls signOut when signOut is invoked', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockSignOut.mockResolvedValueOnce({ error: null });
  mockApiFetch.mockResolvedValueOnce({ id: 'profile1', email: 'user@test.com' });

  render(<AuthProvider><SignOutProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('sign out')).toBeInTheDocument());

  screen.getByText('sign out').click();
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
});

it('fetches and sets profile when session exists', async () => {
  const mockProfile = { id: 'profile1', email: 'user@test.com' };
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockResolvedValueOnce(mockProfile);

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('profile:profile1')).toBeInTheDocument());
  expect(mockApiFetch).toHaveBeenCalledWith('/api/profile', {}, 't');
});

it('sets profile to null when apiFetch rejects', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockRejectedValueOnce(new Error('API error'));

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('no-profile')).toBeInTheDocument());
});
