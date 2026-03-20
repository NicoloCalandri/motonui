import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TripPage from './page';

const mockTrip = {
    id: 'trip-1',
    title: 'Tour del Giappone',
    destination: 'Tokyo, Giappone',
    status: 'active',
    cover_image: null,
    start_date: '2025-04-01',
    end_date: '2025-04-15',
    members: [{ id: 'u1' }, { id: 'u2' }],
    days: [],
    expenses: [],
    media: [],
    posts: [],
};

// Override useParams to return a fixed trip id
vi.mock('next/navigation', async (importActual) => {
    const actual = await importActual<typeof import('next/navigation')>();
    return {
        ...actual,
        useParams: () => ({ id: 'trip-1' }),
        useSearchParams: () => new URLSearchParams(),
    };
});

// Mock dynamic imports (tab components) so they render something quickly
vi.mock('next/dynamic', () => ({
    default: (fn: () => Promise<{ default: () => React.ReactElement }>) => {
        // Return a no-op placeholder; individual tab content is not under test here
        return () => null;
    },
}));

describe('TripPage', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve(mockTrip),
        } as unknown as Response);
    });

    it('shows a loading spinner while fetching data', () => {
        // Don't resolve the fetch immediately
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
        render(<TripPage />);
        expect(screen.getByText(/Caricamento viaggio/i)).toBeDefined();
    });

    it('renders trip title and destination after loading', async () => {
        render(<TripPage />);
        expect(await screen.findByText('Tour del Giappone')).toBeDefined();
        expect(screen.getByText(/Tokyo, Giappone/i)).toBeDefined();
    });

    it('renders members count', async () => {
        render(<TripPage />);
        await screen.findByText('Tour del Giappone');
        expect(screen.getByText(/2 persone/i)).toBeDefined();
    });

    it('renders all 5 tab labels', async () => {
        render(<TripPage />);
        await screen.findByText('Tour del Giappone');
        expect(screen.getByRole('button', { name: /Panoramica/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Itinerario/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Spese/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Foto/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Blog/i })).toBeDefined();
    });

    it('switches active tab on click', async () => {
        const user = userEvent.setup();
        render(<TripPage />);
        await screen.findByText('Tour del Giappone');

        const itineraryTab = screen.getByRole('button', { name: /Itinerario/i });
        await user.click(itineraryTab);

        // The button should now carry the active style (border-terracotta-400)
        expect(itineraryTab.className).toContain('border-terracotta-400');
    });

    it('shows "Viaggio non trovato" when fetch returns no data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve(null),
        } as unknown as Response);

        render(<TripPage />);
        expect(await screen.findByText(/Viaggio non trovato/i)).toBeDefined();
    });

    it('renders "Home" back link pointing to /dashboard', async () => {
        render(<TripPage />);
        await screen.findByText('Tour del Giappone');
        const homeLink = screen.getByRole('link', { name: /Home/i });
        expect(homeLink.getAttribute('href')).toBe('/dashboard');
    });
});
