import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardListSkeleton, TripDetailSkeleton } from './skeleton';
import { seriousA11yViolations } from '@/test/axe';

describe('skeletons', () => {
    it('announce one loading status and hide the placeholder boxes', async () => {
        const { container } = render(<TripDetailSkeleton />);
        expect(screen.getByRole('status').textContent).toBe('Caricamento del viaggio…');
        expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(3);
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('render the requested number of cards', () => {
        const { container } = render(<CardListSkeleton label="Caricamento dei viaggi…" cards={4} />);
        // Title bar + 4 cards.
        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
    });
});
