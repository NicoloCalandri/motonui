import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TripsPage from './page';
import { seriousA11yViolations } from '@/test/axe';

// Mock the Supabase server client; the chain records the search filter.
const calls: { select?: string; or?: [string, unknown] } = {};
let mockRows: { trips: object }[] = [];
const defaultRows = [
    {
        trips: {
            id: 'trip-1',
            title: 'Viaggio di Test',
            destination: 'Parigi',
            status: 'active',
            cover_image: null,
            start_date: '2025-01-01',
        },
    },
];

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-123', email: 'test@example.com' } } }),
    },
    from: () => {
      const chain = {
        select: (columns: string) => { calls.select = columns; return chain; },
        eq: () => chain,
        or: (filter: string, options: unknown) => { calls.or = [filter, options]; return chain; },
        order: () => Promise.resolve({ data: mockRows }),
      };
      return chain;
    },
  }),
}));

describe('TripsPage', () => {
    beforeEach(() => {
        mockRows = defaultRows;
        delete calls.select;
        delete calls.or;
    });

    it('filters on title and destination with the q param', async () => {
        render(await TripsPage({ searchParams: Promise.resolve({ q: 'Parigi' }) }));
        expect(calls.select).toBe('trips!inner(*)');
        expect(calls.or).toEqual(['title.ilike.%Parigi%,destination.ilike.%Parigi%', { referencedTable: 'trips' }]);
        expect(screen.getByText(/Risultati per «Parigi»/)).toBeDefined();
    });

    it('does not filter without q', async () => {
        render(await TripsPage({ searchParams: Promise.resolve({}) }));
        expect(calls.select).toBe('trips(*)');
        expect(calls.or).toBeUndefined();
    });

    it('shows a search empty state when q matches nothing', async () => {
        mockRows = [];
        render(await TripsPage({ searchParams: Promise.resolve({ q: 'Atlantide' }) }));
        expect(screen.getByRole('heading', { name: /Nessun viaggio per «Atlantide»/ })).toBeDefined();
        expect(screen.getByRole('link', { name: 'Vedi tutti i viaggi' }).getAttribute('href')).toBe('/trips');
    });

    it('renders the trips list with at least one trip', async () => {
        // Await the Server Component
        const Result = await TripsPage();
        render(Result);
        
        expect(screen.getByText(/I vostri viaggi/i)).toBeDefined();
        expect(screen.getByText(/Viaggio di Test/i)).toBeDefined();
        expect(screen.getByText(/Parigi/i)).toBeDefined();
    });

    it('renders the "new trip" call to action', async () => {
        const Result = await TripsPage();
        render(Result);
        expect(screen.getByText(/Crea nuovo viaggio/i)).toBeDefined();
    });

    it('renders the page header', async () => {
        const Result = await TripsPage();
        render(Result);
        expect(screen.getByText(/I vostri viaggi/i)).toBeDefined();
    });

    it('has no serious axe violations (T-3.9)', async () => {
        const { container } = render(await TripsPage());
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
