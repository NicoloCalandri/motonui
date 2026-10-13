import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import ProfilePage from '../app/(app)/profile/page';

/**
 * The profile page, its content and the account deletion are copied from the
 * Next.js app (src/app/(app)/profile, src/components/profile). They talk to
 * the API with SWR and plain fetch.
 */

const API: Record<string, unknown> = {
    '/api/profile': { id: 'user-1', email: 'giorgia@example.com', fullName: 'Giorgia', avatarUrl: null },
    '/api/profile/stats': { trips: 3, posts: 1 },
};

const fetchMock = vi.fn();
const assign = vi.fn();

function show() {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <MemoryRouter><ProfilePage /></MemoryRouter>
        </SWRConfig>,
    );
}

beforeEach(() => {
    fetchMock.mockReset();
    assign.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (init?.method === 'POST' && path === '/api/account/delete') return new Response(JSON.stringify({ deleted: true }), { status: 200 });
        if (init?.method && path === '/api/profile') return new Response(JSON.stringify({ ...(API['/api/profile'] as object), fullName: 'Giorgia C.' }), { status: 200 });
        return path in API ? new Response(JSON.stringify(API[path]), { status: 200 }) : new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('profile page', () => {
    it('shows the name, the email and the numbers of the user', async () => {
        show();

        expect(await screen.findByDisplayValue('Giorgia')).toBeInTheDocument();
        expect(screen.getAllByText('giorgia@example.com').length).toBeGreaterThan(0);
        expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(expect.arrayContaining(['/api/profile', '/api/profile/stats']));
    });

    it('deletes the account only after the confirmation word, then leaves the app', async () => {
        const user = userEvent.setup();
        show();
        await screen.findByDisplayValue('Giorgia');

        await user.type(screen.getByLabelText('Scrivi ELIMINA per confermare'), 'ELIMINA');
        await user.click(screen.getByRole('button', { name: 'Elimina definitivamente' }));

        await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/login'));
        const [, init] = fetchMock.mock.calls.find(([input]) => String(input) === '/api/account/delete') as [string, RequestInit];
        expect(JSON.parse(String(init.body))).toEqual({ confirm: 'ELIMINA' });
    });
});
