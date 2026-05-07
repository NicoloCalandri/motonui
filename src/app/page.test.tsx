import { describe, it, expect, vi } from 'vitest';

// next/navigation is already mocked in setup.ts; we only need to spy on redirect
const redirectMock = vi.fn();
vi.mock('next/navigation', async (importActual) => {
    const actual = await importActual<typeof import('next/navigation')>();
    return { ...actual, redirect: redirectMock };
});

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({})),
}));

vi.mock('@/lib/auth/get-user', () => ({
    getAuthUser: vi.fn(async () => ({ id: 'user-1' })),
}));

describe('RootPage', () => {
    it('redirects to /dashboard', async () => {
        const { default: RootPage } = await import('./page');
        await RootPage();
        expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    });
});
