import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from './page';

// Mutable fixtures so individual tests can control data
let mockUserEmail = 'test@example.com';
let mockMemberRows: { trips: object }[] = [];

vi.mock('@/lib/supabase/server', () => ({
    createClient: () =>
        Promise.resolve({
            auth: {
                getUser: () =>
                    Promise.resolve({ data: { user: { email: mockUserEmail, id: 'user-1' } } }),
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        order: () => Promise.resolve({ data: mockMemberRows }),
                    }),
                }),
            }),
        }),
}));

const makeTrip = (overrides: object = {}) => ({
    id: 'trip-1',
    title: 'Viaggio di Test',
    destination: 'Tokyo, Giappone',
    status: 'active',
    cover_image: null,
    start_date: '2025-04-01',
    end_date: '2025-04-15',
    ...overrides,
});

describe('DashboardPage', () => {
    beforeEach(() => {
        mockUserEmail = 'test@example.com';
        mockMemberRows = [];
    });

    it('renders greeting with username derived from email', async () => {
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText(/Ciao test/i)).toBeDefined();
    });

    it('renders the "Inizia nuovo viaggio" CTA link', async () => {
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText(/Inizia nuovo viaggio/i)).toBeDefined();
    });

    it('renders "Viaggi totali" stats label', async () => {
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText(/Viaggi totali/i)).toBeDefined();
    });

    it('shows 0 when user has no trips', async () => {
        mockMemberRows = [];
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText('0')).toBeDefined();
    });

    it('shows correct trip count when trips are present', async () => {
        mockMemberRows = [
            { trips: makeTrip({ id: 'trip-1' }) },
            { trips: makeTrip({ id: 'trip-2', status: 'completed' }) },
        ];
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText('2')).toBeDefined();
    });

    it('shows the active trip title when there is an active trip', async () => {
        mockMemberRows = [{ trips: makeTrip({ title: 'Avventura in Giappone', status: 'active' }) }];
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText('Avventura in Giappone')).toBeDefined();
    });

    it('shows the empty state when no active trip', async () => {
        mockMemberRows = [];
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText(/Pronti per una nuova avventura/i)).toBeDefined();
    });

    it('uses email prefix as name when email is different', async () => {
        mockUserEmail = 'sara@example.com';
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText(/Ciao sara/i)).toBeDefined();
    });

    it('renders the "Vedi tutti i viaggi" link', async () => {
        const Result = await DashboardPage();
        render(Result);
        expect(screen.getByText(/Vedi tutti i viaggi/i)).toBeDefined();
    });
});
