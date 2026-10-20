import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { seriousA11yViolations } from '../../test/axe';

/**
 * The public blog, without a session: index and post. Counterpart of
 * src/app/(public)/blog, which renders on the server; here the posts are read
 * in the browser with the same queries (lib/blog/public-posts.ts) and the
 * post body is sanitized again before it becomes HTML (lib/blog/render.ts).
 */

const posts = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), related: vi.fn() }));
vi.mock('../../lib/blog/public-posts', () => ({
    listPublishedPosts: posts.list,
    getPublishedPost: posts.get,
    listRelatedPosts: posts.related,
}));
vi.mock('../../lib/supabase-client', () => ({ supabase: { from: vi.fn() } }));

import { BlogLayout } from './BlogLayout';
import { BlogIndexPage } from './BlogIndexPage';
import { BlogPostPage } from './BlogPostPage';

const CARD = {
    id: 'p1', title: 'Tramonto a Rapa Nui', slug: 'tramonto-a-rapa-nui', cover_image: null, published_at: '2026-10-01T10:00:00Z',
    reading_time: 4, seo_description: 'Una sera ad Anakena.', trip_id: 't1', trips: { id: 't1', title: 'Rapa Nui', destination: 'Cile' },
};
const paragraph = (marks: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Il moai guarda il mare', marks }] }] });

function open(path: string) {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route element={<BlogLayout />}>
                        <Route path="/blog" element={<BlogIndexPage />} />
                        <Route path="/blog/:slug" element={<BlogPostPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </SWRConfig>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    posts.list.mockResolvedValue([CARD]);
    posts.get.mockResolvedValue({ ...CARD, content_json: paragraph([]), seo_title: null, og_description: null });
    posts.related.mockResolvedValue([]);
});

describe('blog index', () => {
    it('lists the published posts, each linking to its page', async () => {
        const { container } = open('/blog');

        expect(await screen.findByRole('heading', { name: 'Il nostro diario di viaggio' })).toBeInTheDocument();
        const link = await screen.findByRole('link', { name: /tramonto a rapa nui/i });
        expect(link).toHaveAttribute('href', '/blog/tramonto-a-rapa-nui');
        expect(screen.getByText('Cile')).toBeInTheDocument();
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('says the diary is still empty when there are no posts', async () => {
        posts.list.mockResolvedValue([]);
        open('/blog');

        expect(await screen.findByText(/il diario è ancora in bianco/i)).toBeInTheDocument();
    });

    it('says so when the posts cannot be loaded', async () => {
        posts.list.mockRejectedValue(new Error('relation "secret_table" does not exist'));
        open('/blog');

        expect(await screen.findByRole('alert')).toHaveTextContent(/non riusciamo a caricare/i);
        expect(document.body.textContent).not.toContain('secret_table');
    });
});

describe('blog post', () => {
    it('shows the post with its body and sets the page title', async () => {
        const { container } = open('/blog/tramonto-a-rapa-nui');

        expect(await screen.findByRole('heading', { level: 1, name: 'Tramonto a Rapa Nui' })).toBeInTheDocument();
        expect(screen.getByText('Il moai guarda il mare')).toBeInTheDocument();
        expect(posts.get.mock.calls[0][1]).toBe('tramonto-a-rapa-nui');
        await waitFor(() => expect(document.title).toContain('Tramonto a Rapa Nui'));
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('never turns a script link stored in the post into a link', async () => {
        posts.get.mockResolvedValue({ ...CARD, content_json: paragraph([{ type: 'link', attrs: { href: 'javascript:alert(document.cookie)' } }]) });
        const { container } = open('/blog/tramonto-a-rapa-nui');

        await screen.findByText('Il moai guarda il mare');
        expect(container.innerHTML).not.toContain('javascript:');
    });

    it('shows a not-found page for a post that does not exist or is not published', async () => {
        posts.get.mockResolvedValue(null);
        open('/blog/non-esiste');

        expect(await screen.findByRole('heading', { name: /introvabile/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /tutti i post/i })).toHaveAttribute('href', '/blog');
    });

    it('lists other posts of the same trip', async () => {
        posts.related.mockResolvedValue([{ id: 'p2', title: 'I moai di Tongariki', slug: 'i-moai-di-tongariki', cover_image: null, reading_time: 3, published_at: null }]);
        open('/blog/tramonto-a-rapa-nui');

        expect(await screen.findByRole('link', { name: /i moai di tongariki/i })).toHaveAttribute('href', '/blog/i-moai-di-tongariki');
    });
});
