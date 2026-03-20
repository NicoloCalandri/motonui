import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotFound from './not-found';

describe('NotFoundPage', () => {
    it('renders the 404 headline', () => {
        render(<NotFound />);
        expect(screen.getByText(/Persi nell'oceano/i)).toBeDefined();
    });

    it('renders the explanatory paragraph', () => {
        render(<NotFound />);
        expect(screen.getByText(/la rotta che stai seguendo/i)).toBeDefined();
    });

    it('renders a link back to the dashboard', () => {
        render(<NotFound />);
        const link = screen.getByRole('link', { name: /Torna alla Dashboard/i });
        expect(link).toBeDefined();
        expect(link.getAttribute('href')).toBe('/dashboard');
    });
});
