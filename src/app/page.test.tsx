import { describe, it, expect, vi } from 'vitest';

// next/navigation is already mocked in setup.ts; we only need to spy on redirect
const redirectMock = vi.fn();
vi.mock('next/navigation', async (importActual) => {
    const actual = await importActual<typeof import('next/navigation')>();
    return { ...actual, redirect: redirectMock };
});

describe('RootPage', () => {
    it('redirects to /dashboard', async () => {
        const { default: RootPage } = await import('./page');
        // The component calls redirect() synchronously during render;
        // next/navigation.redirect throws in Next.js but the mock just records the call.
        try { RootPage(); } catch { /* redirect throws in tests */ }
        expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    });
});
