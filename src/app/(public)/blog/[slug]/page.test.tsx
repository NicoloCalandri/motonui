import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BlogPostPage, { generateMetadata } from './page';
import { seriousA11yViolations } from '@/test/axe';

const mockPostData = {
    id: '1',
    title: 'Post Titolo',
    slug: 'post-slug',
    published_at: '2025-01-01',
    reading_time: 8,
    trip_id: 'trip-1',
    cover_image: null,
    content_json: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenuto test' }] }],
    },
    trips: { destination: 'Francia', title: 'Viaggio in Francia' },
};

// Public blog reads through the anonymous client (T-5.1): the post query
// selects content_json, the related-posts query does not.
vi.mock('@/lib/supabase/public', async () => {
    const { queryChain } = await import('@/test/supabase-mock');
    return {
        createPublicClient: () => ({
            from: () => ({
                select: (columns: string) =>
                    columns.includes('content_json')
                        ? queryChain({ data: mockPostData, error: null })
                        : queryChain({ data: [], error: null }),
            }),
        }),
    };
});

// Mock Tiptap HTML generation
vi.mock('@tiptap/html/server', () => ({
    generateHTML: () => '<p>Contenuto test</p>',
}));

// Avoid loading actual Tiptap extensions in test environment
vi.mock('@tiptap/starter-kit', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-image', () => ({ default: {} }));
vi.mock('@tiptap/extension-link', () => ({ default: {} }));

describe('BlogPostPage', () => {
    it('renders the blog post title', async () => {
        const Result = await BlogPostPage({ params: Promise.resolve({ slug: 'post-slug' }) });
        render(Result);
        expect(screen.getByText(/Post Titolo/i)).toBeDefined();
    });

    it('renders the trip destination', async () => {
        const Result = await BlogPostPage({ params: Promise.resolve({ slug: 'post-slug' }) });
        render(Result);
        expect(screen.getByText(/Francia/i)).toBeDefined();
    });

    it('renders the post HTML content', async () => {
        const Result = await BlogPostPage({ params: Promise.resolve({ slug: 'post-slug' }) });
        render(Result);
        expect(screen.getByText(/Contenuto test/i)).toBeDefined();
    });

    it('renders reading time when available', async () => {
        const Result = await BlogPostPage({ params: Promise.resolve({ slug: 'post-slug' }) });
        render(Result);
        expect(screen.getByText(/8 min/i)).toBeDefined();
    });

    it('renders the "Tutti i post" back link pointing to /blog', async () => {
        const Result = await BlogPostPage({ params: Promise.resolve({ slug: 'post-slug' }) });
        render(Result);
        const backLink = screen.getByRole('link', { name: /Tutti i post/i });
        expect(backLink.getAttribute('href')).toBe('/blog');
    });

    it('builds article metadata with a canonical URL (T-5.2)', async () => {
        const meta = await generateMetadata({ params: Promise.resolve({ slug: 'post-slug' }) });
        expect(meta.title).toBe('Post Titolo');
        expect(meta.alternates?.canonical).toMatch(/\/blog\/post-slug$/);
        expect(meta.openGraph).toMatchObject({ type: 'article', publishedTime: '2025-01-01' });
    });

    it('has no serious axe violations (T-3.9)', async () => {
        const { container } = render(await BlogPostPage({ params: Promise.resolve({ slug: 'post-slug' }) }));
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
