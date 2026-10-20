import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { seriousA11yViolations } from '../test/axe';
import DayDrawer from './trip/DayDrawer';
import LegDrawer from './trip/LegDrawer';
import AccommodationDrawer from './trip/AccommodationDrawer';
import ActivityDrawer from './booking/ActivityDrawer';
import RestaurantDrawer from './booking/RestaurantDrawer';
import ExpenseDrawer from './expense/ExpenseDrawer';

/**
 * Every form drawer is a labelled modal dialog, keeps focus inside, closes
 * with Escape and has no serious axe violations. Counterpart of
 * src/components/drawers.a11y.test.tsx for the drawers ported so far.
 */

vi.mock('../lib/auth-context', () => ({
    useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'token-1' }, profile: null, isLoading: false, profileLoading: false }),
}));
vi.mock('../lib/api-client', () => ({ apiFetch: vi.fn().mockResolvedValue([]) }));

const TRIP = '10000000-0000-4000-8000-00000000000a';

const drawers: Array<[string, string, (onClose: () => void) => ReactElement]> = [
    ['DayDrawer', 'Nuovo giorno', (onClose) => <DayDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['LegDrawer', 'Nuovo spostamento', (onClose) => <LegDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['AccommodationDrawer', 'Nuovo alloggio', (onClose) => <AccommodationDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['ActivityDrawer', 'attività', (onClose) => <ActivityDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['RestaurantDrawer', 'ristorante', (onClose) => <RestaurantDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
    ['ExpenseDrawer', 'Nuova spesa', (onClose) => <ExpenseDrawer tripId={TRIP} open onClose={onClose} onSaved={vi.fn()} />],
];

function show(element: ReactElement) {
    return render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>);
}

describe.each(drawers)('%s', (_name, title, renderDrawer) => {
    it('is a modal dialog named by its title', () => {
        show(renderDrawer(vi.fn()));
        const dialog = screen.getByRole('dialog', { name: new RegExp(title, 'i') });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes with Escape and from the labelled close button', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        show(renderDrawer(onClose));

        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Chiudi' }));

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('has no serious axe violations', async () => {
        const { container } = show(renderDrawer(vi.fn()));
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
