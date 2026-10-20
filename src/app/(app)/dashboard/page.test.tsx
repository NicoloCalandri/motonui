import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from './page';
import { seriousA11yViolations } from '@/test/axe';

// Mutable fixtures so individual tests can control data
let mockUserEmail = 'test@example.com';
let mockDisplayName: string | null = null;
let mockMemberRows: { trips: object }[] = [];
let mockExpenses: { amount_eur: number | null }[] = [];

vi.mock('@/lib/supabase/server', () => ({
    createClient: () =>
        Promise.resolve({
            auth: {
                getUser: () =>
                    Promise.resolve({ data: { user: { email: mockUserEmail, id: 'user-1' } } }),
            },
            from: (table: string) => {
                if (table === 'profiles') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({ data: { display_name: mockDisplayName } }),
                            }),
                        }),
                    };
                }
                if (table === 'expenses') {
                    return {
                        select: () => ({
                            eq: () => Promise.resolve({ data: mockExpenses }),
                        }),
                    };
                }
                // trip_members (default)
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => Promise.resolve({ data: mockMemberRows }),
                        }),
                    }),
                };
            },
        }),
}));

const makeTrip = (overrides: object = {}) => ({
    id: 'trip-1',
    title: 'Viaggio di Test',
    destination: 'Tokyo, Giappone',
    status: 'active',
    cover_image: null,
    start_date: '2026-10-01',
    end_date: '2026-10-25',
    budget_eur: null,
    ...overrides,
});

async function renderPage() {
    return render(await DashboardPage());
}

describe('DashboardPage', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-20T10:00:00'));
        mockUserEmail = 'test@example.com';
        mockDisplayName = null;
        mockMemberRows = [];
        mockExpenses = [];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('greeting', () => {
        it('uses the email local part without a display name', async () => {
            mockUserEmail = 'giorgia@example.com';
            await renderPage();
            expect(screen.getByText('Ciao giorgia')).toBeDefined();
        });

        it('uses only the first name of the display name', async () => {
            mockDisplayName = 'Nicolò Calandri';
            await renderPage();
            expect(screen.getByText('Ciao Nicolò')).toBeDefined();
            expect(screen.queryByText(/Calandri/)).toBeNull();
        });
    });

    describe('hero', () => {
        it('shows the active trip with its spending against the budget', async () => {
            mockMemberRows = [{ trips: makeTrip({ title: 'Avventura in Giappone', budget_eur: 2000 }) }];
            mockExpenses = [{ amount_eur: 300 }, { amount_eur: 200 }, { amount_eur: null }];
            await renderPage();
            expect(screen.getByText('Viaggio attivo')).toBeDefined();
            expect(screen.getByText('Avventura in Giappone')).toBeDefined();
            expect(screen.getByText('€500')).toBeDefined();
            expect(screen.queryByText(/Pronti per una nuova avventura/i)).toBeNull();
        });

        it('shows the next planned trip with a countdown when nothing is active', async () => {
            mockMemberRows = [
                { trips: makeTrip({ id: 'far', title: 'Islanda', status: 'planning', start_date: '2027-02-01', end_date: null }) },
                { trips: makeTrip({ id: 'next', title: 'Brasile 2026', status: 'planning', start_date: '2026-10-30', end_date: '2026-11-15' }) },
            ];
            await renderPage();
            expect(screen.getAllByText('Prossimo viaggio').length).toBeGreaterThan(0);
            expect(screen.getByRole('heading', { name: 'Brasile 2026' })).toBeDefined();
            expect(screen.getByText(/Partite tra 10 giorni/)).toBeDefined();
            expect(screen.getByRole('link', { name: 'Imposta budget' }).getAttribute('href')).toBe('/trips/next?tab=overview');
            expect(screen.queryByText(/Pronti per una nuova avventura/i)).toBeNull();
        });

        it('shows the empty state, with a single create link, only without trips', async () => {
            await renderPage();
            expect(screen.getByText(/Pronti per una nuova avventura/i)).toBeDefined();
            const createLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/trips/new');
            expect(createLinks).toHaveLength(1);
        });
    });

    describe('recent trips', () => {
        it('does not repeat the hero trip', async () => {
            mockMemberRows = [
                { trips: makeTrip({ id: 'hero', title: 'In corso' }) },
                { trips: makeTrip({ id: 'past', title: 'Lisbona', status: 'completed', end_date: '2025-05-01' }) },
            ];
            await renderPage();
            expect(screen.getAllByText('In corso')).toHaveLength(1);
            expect(screen.getByText('Lisbona')).toBeDefined();
        });

        it('keeps the "Vedi tutti i viaggi" link', async () => {
            await renderPage();
            expect(screen.getByRole('link', { name: /Vedi tutti i viaggi/i })).toBeDefined();
        });
    });

    it('counts trips in the singular and plural', async () => {
        mockMemberRows = [{ trips: makeTrip({ status: 'completed' }) }];
        const { unmount } = await renderPage();
        expect(screen.getByText('1 viaggio')).toBeDefined();
        unmount();

        mockMemberRows = [{ trips: makeTrip({ id: 'a' }) }, { trips: makeTrip({ id: 'b', status: 'completed' }) }];
        await renderPage();
        expect(screen.getByText('2 viaggi')).toBeDefined();
    });

    it('has no serious axe violations (T-3.9)', async () => {
        mockMemberRows = [{ trips: makeTrip() }];
        const { container } = await renderPage();
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
