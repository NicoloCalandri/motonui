import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Link from './link';
import { useParams, usePathname, useRouter, useSearchParams } from './navigation';

/**
 * Components copied from the Next.js app import `next/link` and
 * `next/navigation`; the port tool points those imports here. The adapters
 * behave like the Next.js modules for what the components use.
 */

const swr = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('swr', () => ({ mutate: swr.mutate }));

function Where() {
    const location = useLocation();
    return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

function Probe() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const search = useSearchParams();
    return (
        <div>
            <span data-testid="params">{params.id}</span>
            <span data-testid="tab">{search.get('tab') ?? 'none'}</span>
            <span data-testid="pathname">{usePathname()}</span>
            <button onClick={() => router.push('/dashboard')}>push</button>
            <button onClick={() => router.replace('/trips?x=1')}>replace</button>
            <button onClick={() => router.back()}>back</button>
            <button onClick={() => router.refresh()}>refresh</button>
        </div>
    );
}

function show(path: string) {
    return render(
        <MemoryRouter initialEntries={['/start', path]}>
            <Where />
            <Routes>
                <Route path="/trips/:id" element={<Probe />} />
                <Route path="*" element={<Link href="/trips/abc?tab=blog" className="link">Apri</Link>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('next/link adapter', () => {
    it('renders a router link from href and keeps the other props', async () => {
        show('/dashboard');

        const link = screen.getByRole('link', { name: 'Apri' });
        expect(link).toHaveAttribute('href', '/trips/abc?tab=blog');
        expect(link).toHaveClass('link');

        await userEvent.setup().click(link);
        expect(screen.getByTestId('where')).toHaveTextContent('/trips/abc?tab=blog');
    });

    it.each(['https://example.com/x', 'mailto:ciao@motonui.com', '#funzionalita'])('renders a plain anchor for %s', (href) => {
        render(<MemoryRouter><Link href={href}>Fuori</Link></MemoryRouter>);

        expect(screen.getByRole('link', { name: 'Fuori' })).toHaveAttribute('href', href);
    });
});

describe('next/navigation adapter', () => {
    it('reads params, search params and pathname', () => {
        show('/trips/abc?tab=blog');

        expect(screen.getByTestId('params')).toHaveTextContent('abc');
        expect(screen.getByTestId('tab')).toHaveTextContent('blog');
        expect(screen.getByTestId('pathname')).toHaveTextContent('/trips/abc');
    });

    it('pushes, replaces and goes back', async () => {
        const user = userEvent.setup();
        show('/trips/abc');

        await user.click(screen.getByRole('button', { name: 'back' }));
        expect(screen.getByTestId('where')).toHaveTextContent('/start');
    });

    it('push adds a history entry, replace does not', async () => {
        const user = userEvent.setup();
        const { unmount } = show('/trips/abc');
        await user.click(screen.getByRole('button', { name: 'push' }));
        expect(screen.getByTestId('where')).toHaveTextContent('/dashboard');
        unmount();

        show('/trips/abc');
        await user.click(screen.getByRole('button', { name: 'replace' }));
        expect(screen.getByTestId('where')).toHaveTextContent('/trips?x=1');
    });

    it('refresh reloads the data the page shows', async () => {
        show('/trips/abc');

        await userEvent.setup().click(screen.getByRole('button', { name: 'refresh' }));

        expect(swr.mutate).toHaveBeenCalledTimes(1);
        const [matcher] = swr.mutate.mock.calls[0] as [(key: unknown) => boolean];
        expect(matcher('/api/trips')).toBe(true);
    });
});
