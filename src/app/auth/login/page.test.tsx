import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './page';

// Override global supabase client mock with a configurable version
const mockSignInWithPassword = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        auth: {
            signInWithPassword: mockSignInWithPassword,
            signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
    }),
}));

describe('LoginPage', () => {
    beforeEach(() => {
        mockSignInWithPassword.mockResolvedValue({ error: null });
    });

    it('renders the page heading', () => {
        render(<LoginPage />);
        expect(screen.getByText(/Che bello rivederti/)).toBeDefined();
    });

    it('renders email input field', () => {
        render(<LoginPage />);
        expect(screen.getByPlaceholderText('Email')).toBeDefined();
    });

    it('renders password input field', () => {
        render(<LoginPage />);
        expect(screen.getByPlaceholderText('Password')).toBeDefined();
    });

    it('renders the login submit button', () => {
        render(<LoginPage />);
        expect(screen.getByRole('button', { name: 'Accedi' })).toBeDefined();
    });

    it('renders the "Password dimenticata?" link', () => {
        render(<LoginPage />);
        expect(screen.getByText(/Password dimenticata/i)).toBeDefined();
    });

    it('allows typing in the email field', async () => {
        const user = userEvent.setup();
        render(<LoginPage />);
        const emailInput = screen.getByPlaceholderText('Email') as HTMLInputElement;
        await user.type(emailInput, 'user@example.com');
        expect(emailInput.value).toBe('user@example.com');
    });

    it('allows typing in the password field', async () => {
        const user = userEvent.setup();
        render(<LoginPage />);
        const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
        await user.type(passwordInput, 'secret123');
        expect(passwordInput.value).toBe('secret123');
    });

    it('shows an Italian error message when login fails', async () => {
        mockSignInWithPassword.mockResolvedValueOnce({
            error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
        });

        const user = userEvent.setup();
        render(<LoginPage />);

        await user.type(screen.getByPlaceholderText('Email'), 'bad@example.com');
        await user.type(screen.getByPlaceholderText('Password'), 'wrongpass');
        await user.click(screen.getByRole('button', { name: 'Accedi' }));

        await waitFor(() => {
            expect(screen.getByText(/Email o password non corrispondono/)).toBeDefined();
            expect(screen.queryByText('Invalid login credentials')).toBeNull();
        });
    });

    it('password field starts as type="password"', () => {
        render(<LoginPage />);
        const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
        expect(passwordInput.type).toBe('password');
    });
});
