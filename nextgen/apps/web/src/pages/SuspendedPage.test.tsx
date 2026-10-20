import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SuspendedPage } from './SuspendedPage';
import { seriousA11yViolations } from '../test/axe';

/** The page a suspended user lands on. Counterpart of src/app/(public)/suspended. */

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown>, signOut: vi.fn() }));
vi.mock('../lib/auth-context', () => ({ useAuth: () => auth.value }));

function show() {
    return render(
        <MemoryRouter initialEntries={['/suspended']}>
            <Routes>
                <Route path="/suspended" element={<SuspendedPage />} />
                <Route path="/auth/login" element={<span>login page</span>} />
            </Routes>
        </MemoryRouter>,
    );
}

const suspended = (reason: string | null) => ({
    user: { id: 'user-1', email: 'giorgia@example.com' },
    profile: { role: 'user', suspended_at: '2026-10-01T00:00:00Z', suspended_reason: reason },
    session: { access_token: 'token-1' }, isLoading: false, profileLoading: false, signOut: auth.signOut,
});

beforeEach(() => {
    auth.signOut.mockReset();
    auth.signOut.mockResolvedValue(undefined);
    auth.value = suspended('Verifica in corso');
});

describe('SuspendedPage', () => {
    it('says the account is paused, with the reason and a way to write to us', async () => {
        const { container } = show();

        expect(screen.getByRole('heading', { name: 'Il tuo account è in pausa' })).toBeInTheDocument();
        expect(screen.getByText('Verifica in corso')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'support@motonui.com' })).toHaveAttribute('href', 'mailto:support@motonui.com');
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('shows no reason box when there is none', () => {
        auth.value = suspended(null);
        show();

        expect(screen.queryByText('Motivo')).not.toBeInTheDocument();
    });

    it('signs out and goes to the login page', async () => {
        show();

        await userEvent.setup().click(screen.getByRole('button', { name: /esci dall.account/i }));

        expect(auth.signOut).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    });

    it('sends a visitor without a session to the login page', async () => {
        auth.value = { user: null, profile: null, session: null, isLoading: false, profileLoading: false, signOut: auth.signOut };
        show();

        await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    });
});
