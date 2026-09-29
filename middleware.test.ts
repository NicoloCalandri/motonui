import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

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

const mockVerifyToken = vi.fn();
const mockIsTokenActive = vi.fn();
vi.mock('@/lib/admin/impersonation-token', () => ({
    verifyImpersonationToken: mockVerifyToken,
    isImpersonationTokenActive: mockIsTokenActive,
}));

function makeRequest(
    pathname: string,
    opts: { method?: string; headers?: Record<string, string>; cookies?: Record<string, string> } = {},
) {
    const url = `http://localhost${pathname}`;
    return {
        nextUrl: new URL(url),
        url,
        method: opts.method ?? 'GET',
        headers: new Headers(opts.headers ?? {}),
        cookies: { get: (name: string) => (opts.cookies?.[name] ? { value: opts.cookies[name] } : undefined) },
    } as unknown as NextRequest;
}

function session(user: { id: string } | null, profile: { role: string; suspended_at: string | null } | null = null) {
    const supabaseResponse = MockNextResponse.next();
    mockUpdateSession.mockResolvedValue({ supabaseResponse, user, profile });
    return supabaseResponse;
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
        const result = (await middleware(makeRequest('/dashboard'))) as unknown as MockNextResponse;

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
        const result = (await middleware(makeRequest('/suspended'))) as unknown as MockNextResponse;

        expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects a non-admin user away from /admin routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'user-1' },
            profile: { role: 'user', suspended_at: null },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/admin/users'))) as unknown as MockNextResponse;

        expect(result.redirectUrl).toBe('http://localhost/dashboard');
    });

    it('allows an admin user to access /admin routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: { id: 'admin-1' },
            profile: { role: 'admin', suspended_at: null },
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/admin/users'))) as unknown as MockNextResponse;

        expect(result.redirectUrl).toBeUndefined();
    });

    it('redirects unauthenticated users to /auth/login for protected routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: null,
            profile: null,
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/dashboard'))) as unknown as MockNextResponse;

        expect(result.redirectUrl).toBe('http://localhost/auth/login?redirect=%2Fdashboard');
    });

    it('lets unauthenticated users through on public routes', async () => {
        mockUpdateSession.mockResolvedValue({
            supabaseResponse: MockNextResponse.next(),
            user: null,
            profile: null,
        });

        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/'))) as unknown as MockNextResponse;

        expect(result.redirectUrl).toBeUndefined();
    });

    // ── T-1.9: API behaviour ────────────────────────────────────────────────

    it('answers 401 JSON (not a redirect) for unauthenticated API calls', async () => {
        session(null);
        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/api/trips'))) as unknown as MockNextResponse;

        expect(result.status).toBe(401);
        expect(result.redirectUrl).toBeUndefined();
        expect(result.body).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    });

    it('answers 403 JSON for a suspended user on the API', async () => {
        session({ id: 'user-1' }, { role: 'user', suspended_at: '2024-01-01T00:00:00Z' });
        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/api/trips'))) as unknown as MockNextResponse;

        expect(result.status).toBe(403);
        expect(result.body).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
    });

    it.each([
        ['a foreign Origin', { origin: 'https://evil.example' }],
        ['Origin: null', { origin: 'null' }],
        ['Sec-Fetch-Site: cross-site', { 'sec-fetch-site': 'cross-site' }],
    ])('rejects API writes with %s before touching the session', async (_label, headers) => {
        session({ id: 'user-1' }, { role: 'user', suspended_at: null });
        const { middleware } = await import('./middleware');
        const result = (await middleware(makeRequest('/api/trips', { method: 'POST', headers }))) as unknown as MockNextResponse;

        expect(result.status).toBe(403);
        expect(result.body).toMatchObject({ code: 'CROSS_SITE_REQUEST' });
        expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it.each([
        ['same Origin', { origin: 'http://localhost' }],
        ['Sec-Fetch-Site: same-origin', { 'sec-fetch-site': 'same-origin' }],
        ['no Origin (server to server)', {}],
    ])('lets API writes through with %s', async (_label, headers) => {
        const next = session({ id: 'user-1' }, { role: 'user', suspended_at: null });
        const { middleware } = await import('./middleware');
        const result = await middleware(makeRequest('/api/trips', { method: 'POST', headers }));

        expect(result).toBe(next);
    });

    it('does not require a session nor an Origin on cron routes', async () => {
        const next = session(null);
        const { middleware } = await import('./middleware');
        const result = await middleware(
            makeRequest('/api/admin/send-reminders', { method: 'POST', headers: { origin: 'https://vercel.example' } }),
        );

        expect(result).toBe(next);
    });

    // ── T-1.8: impersonation ────────────────────────────────────────────────

    it('blocks writes during an active impersonation, except exit', async () => {
        session({ id: 'admin-1' }, { role: 'admin', suspended_at: null });
        mockVerifyToken.mockResolvedValue({ adminId: 'admin-1', targetId: 'u-2', jti: 'jti-1' });
        mockIsTokenActive.mockResolvedValue(true);
        const { middleware } = await import('./middleware');

        const blocked = (await middleware(
            makeRequest('/api/trips', { method: 'POST', cookies: { impersonation_token: 't' } }),
        )) as unknown as MockNextResponse;
        expect(blocked.status).toBe(403);
        expect(blocked.body).toMatchObject({ code: 'IMPERSONATION_READ_ONLY' });
        expect(mockIsTokenActive).toHaveBeenCalledWith('jti-1');

        const exit = (await middleware(
            makeRequest('/api/admin/impersonate/exit', { method: 'POST', cookies: { impersonation_token: 't' } }),
        )) as unknown as MockNextResponse;
        expect(exit.status).toBe(200);
    });

    it('drops the cookies of a revoked token instead of honouring it', async () => {
        const next = session({ id: 'admin-1' }, { role: 'admin', suspended_at: null });
        mockVerifyToken.mockResolvedValue({ adminId: 'admin-1', targetId: 'u-2', jti: 'jti-revoked' });
        mockIsTokenActive.mockResolvedValue(false);
        const { middleware } = await import('./middleware');

        const result = (await middleware(
            makeRequest('/api/trips', { method: 'POST', cookies: { impersonation_token: 't' } }),
        )) as unknown as MockNextResponse;

        expect(result).toBe(next);
        expect(next.cookies.delete).toHaveBeenCalledWith('impersonation_token');
        expect(next.cookies.delete).toHaveBeenCalledWith('impersonation_display_name');
    });

    it('does not check revocation for a token that fails verification', async () => {
        const next = session({ id: 'admin-1' }, { role: 'admin', suspended_at: null });
        mockVerifyToken.mockResolvedValue(null);
        const { middleware } = await import('./middleware');

        await middleware(makeRequest('/dashboard', { cookies: { impersonation_token: 'forged' } }));

        expect(mockIsTokenActive).not.toHaveBeenCalled();
        expect(next.cookies.delete).toHaveBeenCalledWith('impersonation_token');
    });
});
