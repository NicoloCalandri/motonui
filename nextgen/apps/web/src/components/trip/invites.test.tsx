import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvitePartnerCard from './InvitePartnerCard';
import { InvitePage } from '../../pages/InvitePage';
import { ApiError } from '../../lib/api-client';
import { seriousA11yViolations } from '../../test/axe';

/**
 * Partner invites: the owner invites by email from the trip page and can copy
 * the link; the partner opens /invite/:token and joins. Counterpart of
 * src/components/trip/InvitePartnerCard.tsx and src/app/(app)/invite/[token].
 */

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock('../../lib/api-client', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../lib/api-client')>()),
    apiFetch: mockApiFetch,
}));
vi.mock('../../lib/auth-context', () => ({
    useAuth: () => ({ session: { access_token: 'token-1' }, user: { id: 'user-1', email: 'nicolo@example.com' } }),
}));

const TRIP = '10000000-0000-4000-8000-00000000000a';
const TOKEN = 'A'.repeat(43);
const LINK = `https://motonui.app/invite/${TOKEN}`;

beforeEach(() => {
    mockApiFetch.mockReset();
});

describe('InvitePartnerCard', () => {
    const invite = async (email: string) => {
        const user = userEvent.setup();
        render(<InvitePartnerCard tripId={TRIP} />);
        await user.type(screen.getByLabelText('Email del partner'), email);
        await user.click(screen.getByRole('button', { name: 'Invia invito' }));
        return user;
    };

    it('sends the invite to the invites route of the trip', async () => {
        mockApiFetch.mockResolvedValue({ invite: { email: 'giorgia@example.com' }, invite_url: LINK, email_sent: true });

        await invite('giorgia@example.com');

        expect(await screen.findByText('Invito inviato a giorgia@example.com. Il link vale 7 giorni.')).toBeInTheDocument();
        const [path, init, token] = mockApiFetch.mock.calls[0] as [string, RequestInit, string];
        expect(path).toBe(`/api/trips/${TRIP}/invites`);
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ email: 'giorgia@example.com' });
        expect(token).toBe('token-1');
    });

    it('asks the owner to share the link when the email was not sent', async () => {
        mockApiFetch.mockResolvedValue({ invite: { email: 'giorgia@example.com' }, invite_url: LINK, email_sent: false });

        await invite('giorgia@example.com');

        expect(await screen.findByText(/condividi tu il link/i)).toBeInTheDocument();
    });

    it('copies the link, which is never printed on the page', async () => {
        mockApiFetch.mockResolvedValue({ invite: { email: 'giorgia@example.com' }, invite_url: LINK, email_sent: true });
        const user = await invite('giorgia@example.com');
        const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

        await user.click(await screen.findByRole('button', { name: 'Copia il link' }));

        expect(writeText).toHaveBeenCalledWith(LINK);
        expect(await screen.findByRole('button', { name: 'Link copiato' })).toBeInTheDocument();
        expect(document.body.textContent).not.toContain(TOKEN);
    });

    it('shows the refusal of the API', async () => {
        mockApiFetch.mockRejectedValue(new ApiError('Questo viaggio ha già due viaggiatori 🏝️', 'TRIP_FULL', 409));

        await invite('giorgia@example.com');

        expect(await screen.findByRole('alert')).toHaveTextContent('Questo viaggio ha già due viaggiatori 🏝️');
    });

    it('refuses an invalid address before calling the API', async () => {
        await invite('non-una-email');

        expect(await screen.findByRole('alert')).toHaveTextContent('Inserisci un indirizzo email valido');
        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('has no serious axe violations', async () => {
        const { container } = render(<InvitePartnerCard tripId={TRIP} />);

        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});

describe('InvitePage', () => {
    const open = (token: string) => render(
        <MemoryRouter initialEntries={[`/invite/${token}`]}>
            <Routes>
                <Route path="/invite/:token" element={<InvitePage />} />
                <Route path="/trips/:id" element={<span>trip page</span>} />
            </Routes>
        </MemoryRouter>,
    );

    it('joins the trip and opens it', async () => {
        mockApiFetch.mockResolvedValue({ trip_id: TRIP });
        open(TOKEN);

        await userEvent.setup().click(screen.getByRole('button', { name: "Accetta l'invito" }));

        await waitFor(() => expect(screen.getByText('trip page')).toBeInTheDocument());
        const [path, init, token] = mockApiFetch.mock.calls[0] as [string, RequestInit, string];
        expect(path).toBe('/api/invites/accept');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
        expect(token).toBe('token-1');
    });

    it('shows why the invite cannot be accepted and lets the user retry', async () => {
        mockApiFetch.mockRejectedValue(new ApiError('Questo invito non è valido o è scaduto. Chiedi un nuovo link 🏝️', 'INVITE_INVALID', 404));
        open(TOKEN);

        await userEvent.setup().click(screen.getByRole('button', { name: "Accetta l'invito" }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/non è valido o è scaduto/i);
        expect(screen.getByRole('button', { name: "Accetta l'invito" })).toBeEnabled();
    });

    it.each(['short', `${'A'.repeat(42)}!`])('does not offer to accept the malformed token %s', (token) => {
        open(token);

        expect(screen.queryByRole('button', { name: "Accetta l'invito" })).not.toBeInTheDocument();
        expect(screen.getByText(/questo invito non è valido/i)).toBeInTheDocument();
        expect(mockApiFetch).not.toHaveBeenCalled();
    });
});
