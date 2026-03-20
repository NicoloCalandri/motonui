import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewTripPage from './page';

describe('NewTripPage', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('renders the step 1 heading', () => {
        render(<NewTripPage />);
        expect(screen.getByText(/Nuovo viaggio/i)).toBeDefined();
    });

    it('renders the trip title input placeholder', () => {
        render(<NewTripPage />);
        expect(screen.getByPlaceholderText(/Giappone 2025/i)).toBeDefined();
    });

    it('renders the destination input', () => {
        render(<NewTripPage />);
        expect(screen.getByPlaceholderText(/Dove volete andare/i)).toBeDefined();
    });

    it('renders the Continue button', () => {
        render(<NewTripPage />);
        // The button has mixed content: "Continua" text + ArrowRight icon
        expect(screen.getByRole('button', { name: /Continua/i })).toBeDefined();
    });

    it('renders step 1 subtitle', () => {
        render(<NewTripPage />);
        expect(screen.getByText(/Il primo passo verso una nuova avventura/i)).toBeDefined();
    });

    it('shows validation error when submitting without a title', async () => {
        const user = userEvent.setup();
        render(<NewTripPage />);

        // Submit without filling in title or destination
        await user.click(screen.getByRole('button', { name: /Continua/i }));

        await waitFor(() => {
            expect(screen.getByText(/Inserisci un nome per il viaggio/i)).toBeDefined();
        });
    });

    it('advances to step 2 after valid step 1 submission', async () => {
        const user = userEvent.setup();
        render(<NewTripPage />);

        await user.type(screen.getByPlaceholderText(/Giappone 2025/i), 'Giappone 2025');
        await user.type(screen.getByPlaceholderText(/Dove volete andare/i), 'Tokyo');
        await user.click(screen.getByRole('button', { name: /Continua/i }));

        await waitFor(() => {
            expect(screen.getByText(/Con chi viaggi/i)).toBeDefined();
        });
    });

    it('shows partner email input on step 2', async () => {
        const user = userEvent.setup();
        render(<NewTripPage />);

        await user.type(screen.getByPlaceholderText(/Giappone 2025/i), 'Viaggio Test');
        await user.type(screen.getByPlaceholderText(/Dove volete andare/i), 'Destinazione');
        await user.click(screen.getByRole('button', { name: /Continua/i }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/partner@example.com/i)).toBeDefined();
        });
    });

    it('shows "Lo farò più tardi" skip button on step 2', async () => {
        const user = userEvent.setup();
        render(<NewTripPage />);

        await user.type(screen.getByPlaceholderText(/Giappone 2025/i), 'Viaggio Test');
        await user.type(screen.getByPlaceholderText(/Dove volete andare/i), 'Destinazione');
        await user.click(screen.getByRole('button', { name: /Continua/i }));

        await waitFor(() => {
            expect(screen.getByText(/Lo farò più tardi/i)).toBeDefined();
        });
    });

    it('shows API error message when trip creation fails', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ error: 'Errore server' }),
        } as Response);

        const user = userEvent.setup();
        render(<NewTripPage />);

        await user.type(screen.getByPlaceholderText(/Giappone 2025/i), 'Viaggio Test');
        await user.type(screen.getByPlaceholderText(/Dove volete andare/i), 'Destinazione');
        await user.click(screen.getByRole('button', { name: /Continua/i }));

        // Skip to step 2, then submit
        await waitFor(() => screen.getByText(/Lo farò più tardi/i));
        await user.click(screen.getByText(/Lo farò più tardi/i));

        await waitFor(() => {
            expect(screen.getByText('Errore server')).toBeDefined();
        });
    });
});
