import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUser } from '@/lib/auth/get-user';

// next/navigation is already mocked in setup.ts; we only need to spy on redirect
const redirectMock = vi.fn();
vi.mock('next/navigation', async (importActual) => {
    const actual = await importActual<typeof import('next/navigation')>();
    return { ...actual, redirect: redirectMock };
});

let sessionUser: AuthUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    })),
}));

vi.mock('@/components/landing-client', () => ({ default: () => null }));

describe('RootPage', () => {
    beforeEach(() => {
        redirectMock.mockClear();
    });

    it('redirects to /dashboard when signed in', async () => {
        sessionUser = { id: 'user-1' };
        const { default: RootPage } = await import('./page');
        await RootPage();
        expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    });

    it('renders the landing page for anonymous visitors', async () => {
        sessionUser = null;
        const { default: RootPage } = await import('./page');
        const element = await RootPage();
        expect(redirectMock).not.toHaveBeenCalled();
        expect(element).toBeTruthy();
    });
});
