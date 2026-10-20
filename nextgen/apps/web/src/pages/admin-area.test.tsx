import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';

/**
 * The admin area: three pages and their dialogs copied from the Next.js app
 * (src/app/(admin)/admin, src/components/admin), inside a layout that the
 * Next.js app renders on the server. The guard here is for navigation only:
 * every admin route of the API checks the role itself.
 */

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../lib/auth-context', () => ({ useAuth: () => auth.value }));
vi.mock('../lib/api-client', () => ({ apiFetch: vi.fn().mockResolvedValue([]) }));
vi.mock('../lib/supabase-client', () => ({ supabase: { storage: { from: vi.fn() }, auth: { getSession: vi.fn(), updateUser: vi.fn() } } }));

import { router } from '../router';

const API: Record<string, unknown> = {
    '/api/admin/stats': { totalUsers: 12, activeUsersLast30Days: 5, totalTrips: 7, totalExpenses: 40, totalPosts: 3, totalAiCalls: 9 },
    '/api/admin/users': {
        users: [{
            id: 'u-2', email: 'giorgia@example.com', displayName: 'Giorgia', avatarUrl: null, role: 'user', plan: 'free',
            premiumUntil: null, suspendedAt: null, tripsCount: 2, expensesCount: 4, postsCount: 1, createdAt: '2026-09-01T00:00:00Z', lastSignInAt: null,
        }],
        total: 1, page: 1, pageSize: 25,
    },
    '/api/admin/audit-log': { entries: [], total: 0, page: 1, pageSize: 50 },
};

const fetchMock = vi.fn();

const account = (role: string) => ({
    user: { id: 'admin-1', email: 'nicolo@example.com' },
    profile: { role, suspended_at: null, display_name: 'Nicolò', avatar_url: null },
    session: { access_token: 'token-1' }, isLoading: false, profileLoading: false, signOut: vi.fn(),
});

function open(path: string) {
    const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <RouterProvider router={memory} />
            </QueryClientProvider>
        </SWRConfig>,
    );
    return memory;
}

beforeEach(() => {
    auth.value = account('admin');
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const path = String(input).split('?')[0];
        return path in API ? new Response(JSON.stringify(API[path]), { status: 200 }) : new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const requested = () => fetchMock.mock.calls.map(([input]) => String(input).split('?')[0]);

describe('admin area', () => {
    it('shows the platform numbers to an admin, with the admin navigation', async () => {
        open('/admin');

        expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
        await waitFor(() => expect(requested()).toContain('/api/admin/stats'));
        expect(screen.getByRole('link', { name: /utenti/i })).toHaveAttribute('href', '/admin/users');
        expect(screen.getByRole('link', { name: /audit/i })).toHaveAttribute('href', '/admin/audit-log');
    });

    it('lists the users', async () => {
        open('/admin/users');

        expect(await screen.findByRole('heading', { name: 'Utenti' })).toBeInTheDocument();
        expect(await screen.findByText('giorgia@example.com')).toBeInTheDocument();
    });

    it('shows the audit log', async () => {
        open('/admin/audit-log');

        expect(await screen.findByRole('heading', { name: 'Audit Log' })).toBeInTheDocument();
        await waitFor(() => expect(requested()).toContain('/api/admin/audit-log'));
    });

    it.each(['/admin', '/admin/users', '/admin/audit-log'])('keeps a user who is not an admin out of %s, without asking the API', async (path) => {
        auth.value = account('user');

        const memory = open(path);

        await waitFor(() => expect(memory.state.location.pathname).toBe('/dashboard'));
        expect(requested().filter((url) => url.startsWith('/api/admin'))).toEqual([]);
    });
});
