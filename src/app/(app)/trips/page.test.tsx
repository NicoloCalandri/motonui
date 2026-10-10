import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TripsPage from './page';
import { seriousA11yViolations } from '@/test/axe';

// Mock the Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-123', email: 'test@example.com' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ 
            data: [
                { 
                    trips: { 
                        id: 'trip-1', 
                        title: 'Viaggio di Test', 
                        destination: 'Parigi', 
                        status: 'active',
                        cover_image: null,
                        start_date: '2025-01-01'
                    } 
                }
            ] 
          }),
        }),
      }),
    }),
  }),
}));

describe('TripsPage', () => {
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
