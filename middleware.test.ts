import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockNextResponse {
    cookies = { set: vi.fn(), delete: vi.fn() };
    status: number;
    body: unknown;
    redirectUrl?: string;
    constructor(body?: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: { status?: number }) {
        return new MockNextResponse(body, init);
    }
    static redirect(url: URL | string) {
        const res = new MockNextResponse(null, { status: 307 });
        res.redirectUrl = url.toString();
        return res;
    }
    static next() {
        return new MockNextResponse(null, { status: 200 });
    }
}

vi.mock('next/server', () => ({ NextResponse: MockNextResponse }));

const mockUpdateSession = vi.fn();
vi.mock('@/lib/supabase/middleware', () => ({
    updateSession: mockUpdateSession,
}));

function makeRequest(pathname: string) {
    const url = `http://localhost${pathname}`;
    return {
        nextUrl: new URL(url),
        url,
        method: 'GET',
        cookies: { get: () => undefined },
    } as any;
}

describe('middleware', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchSpy = vi
            .spyOn(global, 'fetch')
            .mockRejectedValue(new Error('middleware must not make its own network calls'));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it('redirects a suspended user to /suspended', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: '2024-01-01T00:00:00Z' },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/dashboard'))) as any;

        expect(result.redirectUrl).toBe('http://localhost/suspended');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not redirect a suspended user already on /suspended', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: '2024-01-01T00:00:00Z' },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/suspended'))) as any;

        expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects a non-admin user away from /admin routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: null },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/admin/users'))) as any;

        expect(result.redirectUrl).toBe('http://localhost/dashboard');
    });

    it('allows an admin user to access /admin routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'admin-1' },
            profile: { role: 'admin', suspended_at: null },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/admin/users'))) as any;

        expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects unauthenticated users to /auth/login for protected routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: null,
            profile: null,
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/dashboard'))) as any;

        expect(result.redirectUrl).toBe('http://localhost/auth/login?redirect=%2Fdashboard');
    });

    it('lets unauthenticated users through on public routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: null,
            profile: null,
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/'))) as any;

        expect(result.redirectUrl).toBeUndefined();
    });
});
