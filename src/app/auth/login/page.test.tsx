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
        expect(screen.getByText('Welcome Back!')).toBeDefined();
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
        expect(screen.getByText('Log in')).toBeDefined();
    });

    it('renders the "Remember me" checkbox', () => {
        render(<LoginPage />);
        expect(screen.getByText(/Remember me/i)).toBeDefined();
    });

    it('renders the "Forgot password?" button', () => {
        render(<LoginPage />);
        expect(screen.getByText(/Forgot password/i)).toBeDefined();
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

    it('shows error message when login fails', async () => {
        mockSignInWithPassword.mockResolvedValueOnce({
            error: { message: 'Invalid login credentials' },
        });

        const user = userEvent.setup();
        render(<LoginPage />);

        await user.type(screen.getByPlaceholderText('Email'), 'bad@example.com');
        await user.type(screen.getByPlaceholderText('Password'), 'wrongpass');
        await user.click(screen.getByText('Log in'));

        await waitFor(() => {
            expect(screen.getByText('Invalid login credentials')).toBeDefined();
        });
    });

    it('password field starts as type="password"', () => {
        render(<LoginPage />);
        const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
        expect(passwordInput.type).toBe('password');
    });
});
