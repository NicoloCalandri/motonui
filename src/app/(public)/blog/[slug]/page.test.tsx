import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BlogPostPage from './page';

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

// Mock Supabase — supports main post query + related posts chain
vi.mock('@/lib/supabase/server', () => ({
    createClient: () =>
        Promise.resolve({
            from: () => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: mockPostData }),
                            limit: () => Promise.resolve({ data: [] }),
                            neq: () => ({ limit: () => Promise.resolve({ data: [] }) }),
                        }),
                    }),
                }),
            }),
        }),
}));

// Mock Tiptap HTML generation
vi.mock('@tiptap/html', () => ({
    generateHTML: () => '<p>Contenuto test</p>',
}));

// Avoid loading actual Tiptap extensions in test environment
vi.mock('@tiptap/starter-kit', () => ({ default: {} }));
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
});
