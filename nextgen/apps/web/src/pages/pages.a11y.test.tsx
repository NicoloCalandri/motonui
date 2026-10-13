import type { ReactElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { seriousA11yViolations } from '../test/axe';
import { LandingPage } from './LandingPage';
import { DashboardPage } from './DashboardPage';
import { TripsListPage } from './TripsListPage';
import { NewTripPage } from './NewTripPage';
import { LoginPage } from './auth/LoginPage';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';

/** The ported pages have no serious or critical axe violation, like their Next.js sources. */

const TRIP = {
    id: 'trip-1', title: 'Rapa Nui', destination: 'Cile', status: 'planning', cover_image: null,
    start_date: '2026-11-01', end_date: '2026-11-10', created_at: '2026-10-01T00:00:00Z',
};

vi.mock('../lib/auth-context', () => ({
    useAuth: () => ({
        user: { id: 'user-1', email: 'giorgia@example.com' }, profile: { display_name: 'Giorgia' },
        session: { access_token: 'token-1' }, isLoading: false, profileLoading: false, signOut: vi.fn(),
    }),
}));
vi.mock('../lib/api-client', () => ({
    apiFetch: vi.fn(async (path: string) => (path === '/api/trips' ? [TRIP] : { total_spent_eur: 0, budget_eur: null, total_km_traveled: 0 })),
}));
vi.mock('../lib/supabase-client', () => ({ supabase: { auth: { signInWithOAuth: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() } } }));

const pages: Array<[string, ReactElement, string]> = [
    ['LandingPage', <LandingPage />, 'pianificato in due'],
    ['LoginPage', <LoginPage />, 'Che bello rivederti'],
    ['ForgotPasswordPage', <ForgotPasswordPage />, 'Invia il link'],
    ['DashboardPage', <DashboardPage />, 'Rapa Nui'],
    ['TripsListPage', <TripsListPage />, 'Rapa Nui'],
    ['NewTripPage', <NewTripPage />, 'Nuovo viaggio'],
];

describe.each(pages)('%s', (_name, page, text) => {
    it('has no serious axe violations', async () => {
        const { container } = render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter>{page}</MemoryRouter>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(container.textContent).toContain(text));

        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
