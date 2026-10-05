import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousA11yViolations } from '@/test/axe';
import DayDrawer from '@/components/trip/DayDrawer';
import LegDrawer from '@/components/trip/LegDrawer';
import AccommodationDrawer from '@/components/trip/AccommodationDrawer';
import ActivityDrawer from '@/components/booking/ActivityDrawer';
import RestaurantDrawer from '@/components/booking/RestaurantDrawer';
import ExpenseDrawer from '@/components/expense/ExpenseDrawer';
import AddDocumentDrawer from '@/components/wallet/AddDocumentDrawer';

/**
 * T-3.9: every form drawer is a labelled modal dialog, keeps focus inside,
 * closes with Escape and has no serious axe violations.
 */

const TRIP = '10000000-0000-4000-8000-00000000000a';

const drawers: Array<[string, string, (onClose: () => void) => ReactElement]> = [
    ['DayDrawer', 'Nuovo giorno', (onClose) => <DayDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['LegDrawer', 'Nuovo spostamento', (onClose) => <LegDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['AccommodationDrawer', 'Nuovo alloggio', (onClose) => <AccommodationDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['ActivityDrawer', 'attività', (onClose) => <ActivityDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['RestaurantDrawer', 'ristorante', (onClose) => <RestaurantDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['ExpenseDrawer', 'Nuova spesa', (onClose) => <ExpenseDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['AddDocumentDrawer', 'Nuovo documento', (onClose) => <AddDocumentDrawer tripId={TRIP} onClose={onClose} onSaved={vi.fn()} />],
];

describe.each(drawers)('%s', (_name, title, renderDrawer) => {
    it('is a modal dialog named by its title', () => {
        render(renderDrawer(vi.fn()));
        const dialog = screen.getByRole('dialog', { name: new RegExp(title, 'i') });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes with Escape and from the labelled close button', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(renderDrawer(onClose));

        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Chiudi' }));

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('has no serious axe violations', async () => {
        const { container } = render(renderDrawer(vi.fn()));
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
