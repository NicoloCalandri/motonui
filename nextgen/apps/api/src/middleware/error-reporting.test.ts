import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unexpected errors reach Sentry with the route and the request id; expected
 * ones (AppError) do not. Counterpart of withErrorHandler → captureError in
 * the Next.js app (src/lib/errors.ts, src/lib/monitoring.ts).
 */

const sentry = vi.hoisted(() => ({
    captured: [] as Array<{ error: unknown; tags: Record<string, string> }>,
}));

vi.mock('@sentry/node', () => ({
    withScope: (callback: (scope: { setTag: (key: string, value: string) => void }) => void) => {
        const tags: Record<string, string> = {};
        sentry.captured.push({ error: undefined, tags });
        callback({ setTag: (key, value) => { tags[key] = value; } });
    },
    captureException: (error: unknown) => {
        sentry.captured[sentry.captured.length - 1].error = error;
    },
    setUser: () => {},
}));

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.com' };
const state = vi.hoisted(() => ({ role: 'admin' }));

function stubClient() {
    const builder = () => {
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
        const row = { id: ADMIN.id, role: state.role, suspended_at: null };
        chain.single = async () => ({ data: row, error: null });
        chain.maybeSingle = async () => ({ data: row, error: null });
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve);
        return chain;
    };
    return { auth: { getUser: async () => ({ data: { user: ADMIN } }) }, from: builder };
}

vi.mock('../lib/supabase/server', () => ({
    createUserClient: () => stubClient(),
    createAnonClient: () => stubClient(),
    createAdminClient: () => stubClient(),
}));

import { createApp } from '../app';
import { Errors } from '../lib/errors';
import { withErrorHandler } from '../lib/http';

function appWithProbes() {
    const app = createApp();
    app.get('/api/__boom', () => {
        throw new Error('unwrapped');
    });
    app.get('/api/__wrapped', withErrorHandler(async () => {
        throw new Error('wrapped');
    }, 'probe GET'));
    app.get('/api/__forbidden', withErrorHandler(async () => {
        throw Errors.forbidden();
    }, 'probe GET'));
    return app;
}

beforeEach(() => {
    sentry.captured = [];
    state.role = 'admin';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('error reporting', () => {
    it('reports an unexpected error of a wrapped handler with its route and request id', async () => {
        const res = await appWithProbes().request('/api/__wrapped', { headers: { 'x-request-id': 'req-1' } });

        expect(res.status).toBe(500);
        expect(sentry.captured).toHaveLength(1);
        expect((sentry.captured[0].error as Error).message).toBe('wrapped');
        expect(sentry.captured[0].tags).toEqual({ route: 'probe GET', request_id: 'req-1' });
    });

    it('reports an error thrown outside a wrapped handler', async () => {
        await appWithProbes().request('/api/__boom', { headers: { 'x-request-id': 'req-2' } });

        expect(sentry.captured).toHaveLength(1);
        expect(sentry.captured[0].tags).toEqual({ route: 'GET /api/__boom', request_id: 'req-2' });
    });

    it('does not report an expected error', async () => {
        const res = await appWithProbes().request('/api/__forbidden');

        expect(res.status).toBe(403);
        expect(sentry.captured).toEqual([]);
    });
});

describe('GET /api/admin/sentry-test', () => {
    const probe = () => createApp().request('/api/admin/sentry-test', { headers: { authorization: 'Bearer test-token' } });

    it('throws on purpose for an admin, and the error is reported', async () => {
        const res = await probe();

        expect(res.status).toBe(500);
        expect(Object.keys((await res.json()) as object).sort()).toEqual(['code', 'error', 'status']);
        expect(sentry.captured).toHaveLength(1);
        expect(sentry.captured[0].tags.route).toBe('admin/sentry-test GET');
    });

    it('is refused to a non-admin, and nothing is reported', async () => {
        state.role = 'user';

        const res = await probe();

        expect(res.status).toBe(403);
        expect(sentry.captured).toEqual([]);
    });

    it('is refused without a session', async () => {
        const res = await createApp().request('/api/admin/sentry-test');

        expect(res.status).toBe(401);
        expect(sentry.captured).toEqual([]);
    });
});
