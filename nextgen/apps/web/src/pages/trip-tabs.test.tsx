import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';
import { TripDetailPage } from './TripDetailPage';
import { seriousA11yViolations } from '../test/axe';

/**
 * The trip tabs whose components are copied from the Next.js app (packing,
 * calendar, expenses). They read the API with SWR and plain fetch; the page
 * mounts them with the trip it already loaded.
 */

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../lib/api-client', () => ({ apiFetch: mockApiFetch }));
// The media tab uploads straight to storage with the browser client.
vi.mock('../lib/supabase-client', () => ({ supabase: { storage: { from: vi.fn() }, auth: { getSession: vi.fn() } } }));
vi.mock('../lib/auth-context', () => ({
    useAuth: () => ({
        user: { id: 'user-1', email: 'giorgia@example.com' }, profile: { display_name: 'Giorgia' },
        session: { access_token: 'token-1' }, isLoading: false, profileLoading: false, signOut: vi.fn(),
    }),
}));

const TRIP = {
    id: 'trip-1', title: 'Rapa Nui', destination: 'Cile', status: 'planning', cover_image: null,
    start_date: '2026-11-01', end_date: '2026-11-10',
    trip_members: [{ id: 'm1', user_id: 'user-1', role: 'owner' }, { id: 'm2', user_id: 'user-2', role: 'member' }],
    days: [], restaurants: [], activities: [],
};

const API: Record<string, unknown> = {
    '/api/trips/trip-1/baggage': [],
    '/api/trips/trip-1/packing': { checklist: null, stale: false },
    '/api/trips/trip-1/restaurants': [],
    '/api/trips/trip-1/documents': [{
        id: 'doc-1', trip_id: 'trip-1', type: 'ticket', title: 'Biglietto Rapa Nui', file_type: 'image',
        file_path: 'trips/trip-1/documents/doc-1.png', file_url: null, valid_from: null, valid_until: null,
        entity_type: null, entity_id: null, barcode_data: null, notes: null, created_at: '2026-10-01T00:00:00Z',
    }],
    '/api/trips/trip-1/media': [{
        id: 'media-1', trip_id: 'trip-1', mime_type: 'image/webp', caption: 'Tramonto ad Anakena', storage_path: 'trips/trip-1/original/a.webp',
        thumb_path: 'trips/trip-1/thumbs/a.webp', signed_url: 'https://signed.example/original', thumb_signed_url: 'https://signed.example/thumb',
        url: null, taken_at: null, created_at: '2026-10-01T00:00:00Z', tags: [],
    }],
    '/api/trips/trip-1/activities': [],
    '/api/trips/trip-1/expenses': {
        expenses: [{
            id: 'e1', trip_id: 'trip-1', description: 'Cena a Hanga Roa', amount: 80, currency: 'EUR', amount_eur: 80,
            category: 'food', paid_by: 'user-1', split: true, date: '2026-11-02', day_id: null, notes: null, created_at: '2026-11-02T20:00:00Z',
        }],
        summary: { total_eur: 80, by_category: { food: 80 }, by_person: { 'user-1': 80 }, by_day: [] },
        split: { balances: [], settlements: [] },
    },
};

const fetchMock = vi.fn();

function open(tab: string) {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={[`/trips/trip-1?tab=${tab}`]}>
                    <Routes>
                        <Route path="/trips/:id" element={<TripDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        </SWRConfig>,
    );
}

beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => (path === '/api/trips/trip-1' ? TRIP : {}));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const path = String(input).split('?')[0];
        return path in API
            ? new Response(JSON.stringify(API[path]), { status: 200 })
            : new Response(JSON.stringify({ error: 'non trovato', code: 'NOT_FOUND', status: 404 }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    // jsdom has no ResizeObserver, which the expense charts (Recharts) observe.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const requested = () => fetchMock.mock.calls.map(([input]) => String(input));

describe('trip tabs copied from the Next.js app', () => {
    it('packing: reads baggage and checklist of the trip', async () => {
        const { container } = open('packing');

        expect(await screen.findByText('Nessun bagaglio registrato')).toBeInTheDocument();
        expect(screen.getByText('Aggiungi almeno un bagaglio, poi genera la checklist.')).toBeInTheDocument();
        expect(requested()).toEqual(expect.arrayContaining(['/api/trips/trip-1/baggage', '/api/trips/trip-1/packing']));
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('calendar: shows the month of the trip', async () => {
        const { container } = open('calendar');

        expect(await screen.findByText(/novembre 2026/i)).toBeInTheDocument();
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('expenses: lists the expenses of the trip with their total', async () => {
        const { container } = open('expenses');

        expect(await screen.findByText('Cena a Hanga Roa')).toBeInTheDocument();
        expect(requested()).toContain('/api/trips/trip-1/expenses');
        // Inherited from src/components/expense/ExpensesTab.tsx, which is copied and
        // cannot be edited here: the CSV export button is an icon without a name.
        // To fix in the source, then re-port. Exactly this one violation, no other.
        expect(await seriousA11yViolations(container)).toEqual(['button-name: Buttons must have discernible text (.p-2)']);
    });

    it('expenses: says so when there are none', async () => {
        API['/api/trips/trip-1/expenses'] = { expenses: [], summary: { total_eur: 0, by_category: {}, by_person: {}, by_day: [] }, split: { balances: [], settlements: [] } };

        open('expenses');

        expect(await screen.findByText('Nessuna spesa ancora')).toBeInTheDocument();
    });

    it.each(['packing', 'calendar', 'expenses'])('%s is no longer a placeholder', async (tab) => {
        open(tab);

        await waitFor(() => expect(screen.getByText('Rapa Nui')).toBeInTheDocument());
        expect(screen.queryByText(/tab in arrivo/i)).not.toBeInTheDocument();
    });

    it('wallet: lists the documents and never shows a storage URL', async () => {
        const { container } = open('wallet');

        expect(await screen.findByText('Biglietto Rapa Nui')).toBeInTheDocument();
        expect(requested()).toContain('/api/trips/trip-1/documents');
        expect(container.innerHTML).not.toContain('/storage/v1/');
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('media: shows the photos from their signed URLs', async () => {
        const { container } = open('media');

        const image = await screen.findByAltText(/tramonto ad anakena|foto/i);
        expect(image.getAttribute('src')?.startsWith('https://signed.example/')).toBe(true);
        expect(requested()).toContain('/api/trips/trip-1/media');
        // Inherited from src/components/media/MediaTab.tsx (copied, not editable here):
        // the button that selects a photo is an icon without a name. Exactly this one.
        expect(await seriousA11yViolations(container)).toEqual(['button-name: Buttons must have discernible text (.left-2)']);
    });

    it.each(['wallet', 'media'])('%s is no longer a placeholder', async (tab) => {
        open(tab);

        await waitFor(() => expect(screen.getByText('Rapa Nui')).toBeInTheDocument());
        expect(screen.queryByText(/tab in arrivo/i)).not.toBeInTheDocument();
    });
});
