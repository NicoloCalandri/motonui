import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from './page';
import { seriousA11yViolations } from '@/test/axe';

// Mutable fixtures so individual tests can control data
let mockUserEmail = 'test@example.com';
let mockDisplayName: string | null = null;
let mockMemberRows: { trips: object }[] = [];
let mockExpenses: { amount_eur: number | null }[] = [];
let mockPosts: object[] = [];

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
                if (table === 'posts') {
                    return {
                        select: () => ({
                            in: () => ({
                                order: () => ({ limit: () => Promise.resolve({ data: mockPosts }) }),
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
        mockPosts = [];
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

        it('shows the date without the year', async () => {
            await renderPage();
            expect(screen.getByText('Martedì 20 ottobre')).toBeDefined();
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
            expect(screen.getByText('In viaggio')).toBeDefined();
            expect(screen.getByRole('heading', { name: /Avventura in Giappone/ })).toBeDefined();
            expect(screen.getByText(/^500\s€$/)).toBeDefined();
            expect(screen.queryByText(/Pronti per una nuova avventura/i)).toBeNull();
        });

        it('shows the next planned trip with a countdown when nothing is active', async () => {
            mockMemberRows = [
                { trips: makeTrip({ id: 'far', title: 'Islanda', status: 'planning', start_date: '2027-02-01', end_date: null }) },
                { trips: makeTrip({ id: 'next', title: 'Brasile 2026', status: 'planning', start_date: '2026-10-30', end_date: '2026-11-15' }) },
            ];
            await renderPage();
            expect(screen.getByText('Prossimo viaggio')).toBeDefined();
            expect(screen.getByRole('heading', { name: /Brasile 2026/ })).toBeDefined();
            expect(screen.getByText(/Partite tra 10 giorni/)).toBeDefined();
            expect(screen.getByRole('link', { name: 'Imposta budget' }).getAttribute('href')).toBe('/trips/next?tab=overview');
            expect(screen.queryByText(/Pronti per una nuova avventura/i)).toBeNull();
        });

        it('links the title and the quick actions to the trip tabs', async () => {
            mockMemberRows = [{ trips: makeTrip({ id: 'trip-9' }) }];
            await renderPage();
            const hero = screen.getByRole('heading', { name: /Viaggio di Test/ });
            expect(within(hero).getByRole('link').getAttribute('href')).toBe('/trips/trip-9');
            const actions = within(screen.getByRole('navigation', { name: 'Azioni rapide' })).getAllByRole('link');
            expect(actions.map((a) => a.getAttribute('href'))).toEqual([
                '/trips/trip-9?tab=itinerary',
                '/trips/trip-9?tab=expenses',
                '/trips/trip-9?tab=media',
            ]);
        });

        it('shows the empty state only without trips, leaving "Nuovo viaggio" to the header', async () => {
            await renderPage();
            expect(screen.getByText(/Pronti per una nuova avventura/i)).toBeDefined();
            expect(screen.queryAllByRole('link').filter((a) => a.getAttribute('href') === '/trips/new')).toHaveLength(0);
            expect(screen.queryByText(/Il diario è ancora in bianco/)).toBeNull();
        });
    });

    describe('recent trips', () => {
        it('does not repeat the hero trip', async () => {
            mockMemberRows = [
                { trips: makeTrip({ id: 'hero', title: 'In corso' }) },
                { trips: makeTrip({ id: 'past', title: 'Lisbona', status: 'completed', end_date: '2025-05-01' }) },
            ];
            await renderPage();
            expect(screen.getAllByText(/In corso/)).toHaveLength(1);
            expect(screen.getByText('Lisbona')).toBeDefined();
        });

        it('keeps the "Vedi tutti i viaggi" link', async () => {
            mockMemberRows = [{ trips: makeTrip() }];
            await renderPage();
            expect(screen.getByRole('link', { name: /Vedi tutti i viaggi/i })).toBeDefined();
        });
    });

    it('counts trips in the singular and plural', async () => {
        const tripsCard = () => screen.getByRole('region', { name: 'Viaggi' });
        mockMemberRows = [{ trips: makeTrip({ status: 'completed' }) }];
        const { unmount } = await renderPage();
        expect(within(tripsCard()).getByText('1')).toBeDefined();
        expect(within(tripsCard()).getByText('viaggio')).toBeDefined();
        unmount();

        mockMemberRows = [{ trips: makeTrip({ id: 'a' }) }, { trips: makeTrip({ id: 'b', status: 'completed' }) }];
        await renderPage();
        expect(within(tripsCard()).getByText('2')).toBeDefined();
        expect(within(tripsCard()).getByText('viaggi')).toBeDefined();
    });

    describe('diary', () => {
        it('invites to write the first post in the hero trip', async () => {
            mockMemberRows = [{ trips: makeTrip({ id: 'hero' }) }];
            await renderPage();
            expect(screen.getByRole('heading', { name: 'Il diario è ancora in bianco.' })).toBeDefined();
            expect(screen.getByRole('link', { name: /Scrivi il primo post/ }).getAttribute('href')).toBe('/trips/hero?tab=blog');
        });

        it('shows the latest post with a link to its editor', async () => {
            mockMemberRows = [{ trips: makeTrip({ id: 'hero' }) }];
            mockPosts = [{ id: 'p1', title: 'Primo giorno a Tokyo', trip_id: 'hero', status: 'draft' }];
            await renderPage();
            expect(screen.getByRole('heading', { name: 'Primo giorno a Tokyo' })).toBeDefined();
            expect(screen.getByRole('link', { name: /Continua a scrivere/ }).getAttribute('href')).toBe('/trips/hero/posts/p1/edit');
        });
    });

    it('has no serious axe violations (T-3.9)', async () => {
        mockMemberRows = [{ trips: makeTrip() }];
        const { container } = await renderPage();
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
