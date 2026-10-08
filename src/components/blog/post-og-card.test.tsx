import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PostOgCard, clip } from './post-og-card';

describe('PostOgCard (T-5.4)', () => {
    it('clips long text on a word boundary', () => {
        expect(clip('breve', 10)).toBe('breve');
        expect(clip('una lunga giornata sull isola di Pasqua', 20)).toBe('una lunga giornata…');
        expect(clip('x'.repeat(30), 10)).toBe(`${'x'.repeat(9)}…`);
    });

    it('shows title, description, date and reading time', () => {
        render(<PostOgCard title="Rapa Nui" description="Moai al tramonto" publishedAt="2026-09-01T10:00:00Z" readingTime={6} />);
        expect(screen.getByText('Rapa Nui')).toBeDefined();
        expect(screen.getByText('Moai al tramonto')).toBeDefined();
        expect(screen.getByText(/1 settembre 2026 · 6 min di lettura/)).toBeDefined();
    });

    it('falls back to the blog tagline without metadata', () => {
        render(<PostOgCard title="Rapa Nui" />);
        expect(screen.getByText('Storie di viaggio di Nicolò e Giorgia')).toBeDefined();
    });
});
