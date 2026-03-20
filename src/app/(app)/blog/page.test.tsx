import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BlogIndexPage from './page';

// Mutable so individual tests can control post data
let mockPosts: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
    createClient: () =>
        Promise.resolve({
            from: () => ({
                select: () => ({
                    eq: () => ({
                        order: () => Promise.resolve({ data: mockPosts }),
                    }),
                }),
            }),
        }),
}));

describe('BlogIndexPage', () => {
    beforeEach(() => {
        mockPosts = [
            {
                id: '1',
                title: 'Test Post',
                slug: 'test-post',
                published_at: '2025-01-01',
                reading_time: 5,
                seo_description: null,
                cover_image: null,
                trips: { destination: 'Italy' },
            },
        ];
    });

    it('renders the blog index heading', async () => {
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText(/Il Diario di Viaggio/i)).toBeDefined();
    });

    it('renders the page tagline', async () => {
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText(/Storie, fotografie/i)).toBeDefined();
    });

    it('renders a published post title', async () => {
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText(/Test Post/i)).toBeDefined();
    });

    it('renders the post destination', async () => {
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText(/Italy/i)).toBeDefined();
    });

    it('renders reading time when provided', async () => {
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText(/5 min/i)).toBeDefined();
    });

    it('renders the empty state when no posts are published', async () => {
        mockPosts = [];
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText(/Nessun post pubblicato ancora/i)).toBeDefined();
    });

    it('renders multiple posts when provided', async () => {
        mockPosts = [
            {
                id: '1',
                title: 'Post Uno',
                slug: 'post-uno',
                published_at: '2025-01-01',
                reading_time: 3,
                seo_description: null,
                cover_image: null,
                trips: { destination: 'Francia' },
            },
            {
                id: '2',
                title: 'Post Due',
                slug: 'post-due',
                published_at: '2025-02-01',
                reading_time: 7,
                seo_description: null,
                cover_image: null,
                trips: { destination: 'Giappone' },
            },
        ];
        const Result = await BlogIndexPage();
        render(Result);
        expect(screen.getByText('Post Uno')).toBeDefined();
        expect(screen.getByText('Post Due')).toBeDefined();
    });
});
