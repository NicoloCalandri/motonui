import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProfilePage from './page';

beforeEach(() => {
    vi.stubGlobal('fetch', (url: string) => {
        if (url === '/api/profile') {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: '1', email: 'test@example.com', fullName: 'Test User', avatarUrl: null }),
            });
        }
        if (url === '/api/profile/stats') {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ trips: 3, posts: 1 }),
            });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ProfilePage', () => {
    it('renders profile header and email field', async () => {
        render(<ProfilePage />);
        // Wait for loading to finish (ProfilePage has a loading state)
        expect(await screen.findByText('Profilo')).toBeDefined();
        expect(screen.getByText('Personalizza la tua esperienza di viaggio')).toBeDefined();
    });

    it('renders form fields', async () => {
        render(<ProfilePage />);
        expect(await screen.findByLabelText('Nome Completo')).toBeDefined();
        expect(screen.getByLabelText('Email (non modificabile)')).toBeDefined();
    });

    it('renders the Premium Member badge', async () => {
        render(<ProfilePage />);
        await screen.findByText('Profilo');
        expect(screen.getByText('Premium Member')).toBeDefined();
    });

    it('email field is not editable', async () => {
        render(<ProfilePage />);
        const emailInput = (await screen.findByLabelText('Email (non modificabile)')) as HTMLInputElement;
        // The email field should be disabled or read-only
        expect(emailInput.readOnly || emailInput.disabled).toBe(true);
    });
});
