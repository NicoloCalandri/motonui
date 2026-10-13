import { it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

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

function ProfileLoadingProbe() {
  const { profileLoading, profile } = useAuth();
  return <span>{profileLoading ? 'profile-loading' : `profile-loaded:${profile?.id || 'null'}`}</span>;
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
  expect(mockApiFetch).toHaveBeenCalledWith('/api/session', {}, 't');
});

it('sets profile to null when apiFetch rejects', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockRejectedValueOnce(new Error('API error'));

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('no-profile')).toBeInTheDocument());
});

it('sets profileLoading to false when session is null (short-circuit)', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });

  render(<AuthProvider><ProfileLoadingProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('profile-loaded:null')).toBeInTheDocument());
});

it('resolves profileLoading to false after profile fetch succeeds', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  const mockProfile = { id: 'profile1', email: 'user@test.com' };
  mockApiFetch.mockResolvedValueOnce(mockProfile);

  render(<AuthProvider><ProfileLoadingProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('profile-loaded:profile1')).toBeInTheDocument());
});

it('resolves profileLoading to false when profile fetch fails', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockRejectedValueOnce(new Error('API error'));

  render(<AuthProvider><ProfileLoadingProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('profile-loaded:null')).toBeInTheDocument());
});

const profileCalls = () => mockApiFetch.mock.calls.filter(([path]) => path === '/api/session');

function GuardProbe() {
  const { user, profile, isLoading, profileLoading } = useAuth();
  // What a route guard sees: it decides as soon as nothing is loading.
  const state = isLoading || profileLoading ? 'loading' : user ? `decided:${profile?.role ?? 'no-profile'}` : 'decided:anon';
  seen.push(state);
  return <span>{state}</span>;
}
const seen: string[] = [];

it('never lets a guard decide for a signed-in user before the profile has arrived', async () => {
  seen.length = 0;
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockResolvedValueOnce({ id: 'u1', role: 'admin', suspended_at: null });

  render(<AuthProvider><GuardProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('decided:admin')).toBeInTheDocument());

  // An admin reloading /admin must not be seen, even for one render, as a user without a profile.
  expect(seen).not.toContain('decided:no-profile');
});

it('keeps the profile and does not go back to loading when the same user gets a new session object', async () => {
  seen.length = 0;
  let emit: (event: string, session: unknown) => void = () => {};
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't1' } } });
  mockOnAuthStateChange.mockImplementationOnce((callback: (event: string, session: unknown) => void) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mockApiFetch.mockResolvedValue({ id: 'u1', role: 'user', suspended_at: null });

  render(<AuthProvider><GuardProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('decided:user')).toBeInTheDocument());
  seen.length = 0;

  // The browser tab becomes visible again, or the token is refreshed: same user, new object.
  await act(async () => {
    emit('SIGNED_IN', { user: { id: 'u1' }, access_token: 't2' });
    emit('TOKEN_REFRESHED', { user: { id: 'u1' }, access_token: 't3' });
  });

  expect(seen).not.toContain('loading');
  expect(profileCalls()).toHaveLength(1);
});

it('loads the profile again when another user signs in, and ignores a late answer for the previous one', async () => {
  let emit: (event: string, session: unknown) => void = () => {};
  let answerFirst: (value: unknown) => void = () => {};
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't1' } } });
  mockOnAuthStateChange.mockImplementationOnce((callback: (event: string, session: unknown) => void) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  let profileRequests = 0;
  mockApiFetch.mockImplementation((path: string) => {
    if (path !== '/api/session') return Promise.resolve({});
    profileRequests += 1;
    return profileRequests === 1
      ? new Promise((resolve) => { answerFirst = resolve; })
      : Promise.resolve({ id: 'u2', role: 'user', suspended_at: null });
  });

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(profileCalls()).toHaveLength(1));

  await act(async () => { emit('SIGNED_IN', { user: { id: 'u2' }, access_token: 't2' }); });
  await waitFor(() => expect(screen.getByText('profile:u2')).toBeInTheDocument());

  await act(async () => { answerFirst({ id: 'u1', role: 'admin', suspended_at: null }); });
  expect(screen.getByText('profile:u2')).toBeInTheDocument();
});

const cookieCalls = () => mockApiFetch.mock.calls.filter(([path]) => path === '/api/session/cookie');

it('copies the token into the session cookie, and again when the token changes', async () => {
  let emit: (event: string, session: unknown) => void = () => {};
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't1' } } });
  mockOnAuthStateChange.mockImplementationOnce((callback: (event: string, session: unknown) => void) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mockApiFetch.mockResolvedValue({ id: 'u1', role: 'user', suspended_at: null });

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(cookieCalls()).toHaveLength(1));
  expect(cookieCalls()[0]).toEqual(['/api/session/cookie', { method: 'POST' }, 't1']);

  await act(async () => { emit('TOKEN_REFRESHED', { user: { id: 'u1' }, access_token: 't2' }); });
  await waitFor(() => expect(cookieCalls()).toHaveLength(2));
  expect(cookieCalls()[1]).toEqual(['/api/session/cookie', { method: 'POST' }, 't2']);

  // Same token again (the browser tab became visible): nothing to copy.
  await act(async () => { emit('SIGNED_IN', { user: { id: 'u1' }, access_token: 't2' }); });
  expect(cookieCalls()).toHaveLength(2);
});

it('clears the session cookie when the session ends', async () => {
  let emit: (event: string, session: unknown) => void = () => {};
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't1' } } });
  mockOnAuthStateChange.mockImplementationOnce((callback: (event: string, session: unknown) => void) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mockApiFetch.mockResolvedValue({ id: 'u1', role: 'user', suspended_at: null });

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(cookieCalls()).toHaveLength(1));

  await act(async () => { emit('SIGNED_OUT', null); });

  await waitFor(() => expect(cookieCalls()).toHaveLength(2));
  expect(cookieCalls()[1]).toEqual(['/api/session/cookie', { method: 'DELETE' }, undefined]);
});

it('does not touch the cookie for a visitor who never had a session', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });

  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());

  expect(cookieCalls()).toEqual([]);
});

it('drops a local session the API no longer accepts (deleted account, revoked token)', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 'stale' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockImplementation((path: string) =>
    path === '/api/session' ? Promise.reject(Object.assign(new Error('Non sei autenticato.'), { status: 401 })) : Promise.resolve({}));

  render(<AuthProvider><ProfileProbe /></AuthProvider>);

  await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' }));
});

it('keeps the session when the profile cannot be read for another reason', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
  mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockApiFetch.mockImplementation((path: string) =>
    path === '/api/session' ? Promise.reject(Object.assign(new Error('boom'), { status: 500 })) : Promise.resolve({}));

  render(<AuthProvider><ProfileProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('no-profile')).toBeInTheDocument());

  expect(mockSignOut).not.toHaveBeenCalled();
});
