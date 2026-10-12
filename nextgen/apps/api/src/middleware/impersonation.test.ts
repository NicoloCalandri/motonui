import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { SignJWT } from 'jose';

const tokens = vi.hoisted(() => ({ active: vi.fn() }));

vi.mock('../lib/admin/impersonation-token', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/admin/impersonation-token')>()),
    isImpersonationTokenActive: tokens.active,
}));

import { handleImpersonation } from './impersonation';
import type { AppEnv } from '../types';

const SECRET = 'test-impersonation-secret-32-chars-min';

async function signToken(payload: Record<string, unknown>) {
    const secretKey = new TextEncoder().encode(SECRET);
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setJti('jti-1')
        .setExpirationTime('30m')
        .sign(secretKey);
}

function buildApp() {
    const app = new Hono<AppEnv>();
    app.use('*', handleImpersonation);
    app.post('/api/admin/impersonate/exit', (c) => c.json({ ok: true }));
    app.post('/api/trips', (c) => c.json({ ok: true }));
    app.get('/api/trips', (c) => c.json({ ok: true }));
    return app;
}

describe('handleImpersonation middleware', () => {
    beforeEach(() => {
        tokens.active.mockReset();
        tokens.active.mockResolvedValue(true);
    });

    it('ignores a token that was revoked and clears the cookie', async () => {
        tokens.active.mockResolvedValue(false);
        const app = buildApp();
        const token = await signToken({ adminId: 'admin-1', targetId: 'user-1', type: 'impersonation' });

        const res = await app.request('/api/trips', {
            method: 'POST',
            headers: { Cookie: `impersonation_token=${token}` },
        });

        expect(tokens.active).toHaveBeenCalledWith('jti-1');
        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie') ?? '').toContain('impersonation_token=;');
    });

    it('ignores a token that is not an impersonation token', async () => {
        const app = buildApp();
        const token = await signToken({ adminId: 'admin-1', targetId: 'user-1', type: 'session' });

        const res = await app.request('/api/trips', {
            method: 'POST',
            headers: { Cookie: `impersonation_token=${token}` },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie') ?? '').toContain('impersonation_token=;');
    });

    it('passes through with no impersonation cookie', async () => {
        const app = buildApp();
        const res = await app.request('/api/trips');
        expect(res.status).toBe(200);
    });

    it('blocks write methods while impersonating', async () => {
        const app = buildApp();
        const token = await signToken({ adminId: 'admin-1', targetId: 'user-1', type: 'impersonation' });

        const res = await app.request('/api/trips', {
            method: 'POST',
            headers: { Cookie: `impersonation_token=${token}` },
        });

        expect(res.status).toBe(403);
        const body = (await res.json()) as { code: string };
        expect(body.code).toBe('IMPERSONATION_READ_ONLY');
    });

    it('allows the exit route even while impersonating', async () => {
        const app = buildApp();
        const token = await signToken({ adminId: 'admin-1', targetId: 'user-1', type: 'impersonation' });

        const res = await app.request('/api/admin/impersonate/exit', {
            method: 'POST',
            headers: { Cookie: `impersonation_token=${token}` },
        });

        expect(res.status).toBe(200);
    });

    it('allows read methods while impersonating', async () => {
        const app = buildApp();
        const token = await signToken({ adminId: 'admin-1', targetId: 'user-1', type: 'impersonation' });

        const res = await app.request('/api/trips', {
            headers: { Cookie: `impersonation_token=${token}` },
        });

        expect(res.status).toBe(200);
    });

    it('clears the cookie and continues on an invalid token', async () => {
        const app = buildApp();
        const res = await app.request('/api/trips', {
            headers: { Cookie: 'impersonation_token=not-a-real-jwt' },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie') ?? '').toContain('impersonation_token=;');
    });
});
