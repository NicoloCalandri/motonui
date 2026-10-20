import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppShell from './AppShell';
import { SWRTestProvider } from '@/test/swr';
import { seriousA11yViolations } from '@/test/axe';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(),
}));

// next/form needs a mounted app router: a plain GET form behaves the same here.
vi.mock('next/form', () => ({
    default: ({ action, ...props }: React.FormHTMLAttributes<HTMLFormElement> & { action: string }) => (
        <form action={action} {...props} />
    ),
}));

vi.mock('@/components/admin/impersonation-banner', () => ({ default: () => null }));

const profile = { id: 'u1', email: 'nicolo@example.com', fullName: 'Nicolò Calandri', avatarUrl: null };

function renderShell() {
    return render(
        <SWRTestProvider>
            <AppShell profile={profile}>
                <p>Contenuto</p>
            </AppShell>
        </SWRTestProvider>,
    );
}

describe('AppShell', () => {
    beforeEach(() => {
        // /api/profile never answers: whatever the shell shows comes from the server profile.
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the server profile without waiting for /api/profile', () => {
        renderShell();
        expect(screen.getByRole('button', { name: 'Menu di Nicolò Calandri' })).toBeDefined();
    });

    it('names the destinations specifically and marks the current one', () => {
        renderShell();
        const [sidebar, tabBar] = screen.getAllByRole('navigation', { name: 'Principale' });
        for (const nav of [sidebar, tabBar]) {
            const links = within(nav).getAllByRole('link');
            expect(links.map((a) => a.querySelector('span')?.textContent)).toEqual(['Oggi', 'Viaggi', 'Blog', 'Profilo']);
            expect(within(nav).getByRole('link', { name: /Oggi/ }).getAttribute('aria-current')).toBe('page');
            expect(within(nav).getByRole('link', { name: /Viaggi/ }).getAttribute('aria-current')).toBeNull();
        }
    });

    it('keeps "Nuovo viaggio" out of the navigation, as a header action', () => {
        renderShell();
        const create = screen.getByRole('link', { name: 'Nuovo viaggio' });
        expect(create.getAttribute('href')).toBe('/trips/new');
        for (const nav of screen.getAllByRole('navigation')) {
            expect(within(nav).queryByRole('link', { name: 'Nuovo viaggio' })).toBeNull();
        }
    });

    it('has a search landmark that submits q to /trips', () => {
        renderShell();
        const search = screen.getByRole('search');
        expect(search.getAttribute('action')).toBe('/trips');
        const input = within(search).getByRole('searchbox', { name: 'Cerca un viaggio' });
        expect(input.getAttribute('name')).toBe('q');
    });

    it('opens the avatar menu and closes it with Escape, giving focus back', async () => {
        const user = userEvent.setup();
        renderShell();
        const avatar = screen.getByRole('button', { name: 'Menu di Nicolò Calandri' });
        await user.click(avatar);
        expect(avatar.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: 'Esci' })).toBeDefined();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(avatar.getAttribute('aria-expanded')).toBe('false'));
        expect(document.activeElement).toBe(avatar);
    });

    it('closes the avatar menu on a click outside', async () => {
        const user = userEvent.setup();
        renderShell();
        const avatar = screen.getByRole('button', { name: 'Menu di Nicolò Calandri' });
        await user.click(avatar);
        await user.click(screen.getByText('Contenuto'));
        await waitFor(() => expect(avatar.getAttribute('aria-expanded')).toBe('false'));
    });

    it('has no serious axe violations', async () => {
        const { container } = renderShell();
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
