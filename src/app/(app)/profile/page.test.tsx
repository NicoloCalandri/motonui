import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SWRTestProvider } from '@/test/swr';
import ProfilePage from './page';
import { seriousA11yViolations } from '@/test/axe';

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
        render(<ProfilePage />, { wrapper: SWRTestProvider });
        // Wait for loading to finish (ProfilePage has a loading state)
        expect(await screen.findByText('Profilo')).toBeDefined();
        expect(screen.getByText('Personalizza la tua esperienza di viaggio')).toBeDefined();
    });

    it('renders form fields', async () => {
        render(<ProfilePage />, { wrapper: SWRTestProvider });
        expect(await screen.findByLabelText('Nome Completo')).toBeDefined();
        expect(screen.getByLabelText('Email (non modificabile)')).toBeDefined();
    });

    it('renders the Membro Premium badge', async () => {
        render(<ProfilePage />, { wrapper: SWRTestProvider });
        await screen.findByText('Profilo');
        expect(screen.getByText('Membro Premium')).toBeDefined();
    });

    it('email field is not editable', async () => {
        render(<ProfilePage />, { wrapper: SWRTestProvider });
        const emailInput = (await screen.findByLabelText('Email (non modificabile)')) as HTMLInputElement;
        // The email field should be disabled or read-only
        expect(emailInput.readOnly || emailInput.disabled).toBe(true);
    });

    it('has no serious axe violations (T-3.9)', async () => {
        const { container } = render(<ProfilePage />, { wrapper: SWRTestProvider });
        await screen.findByText('Profilo');
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});
