import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { mockRequireAdmin } = vi.hoisted(() => ({ mockRequireAdmin: vi.fn() }));
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/monitoring', () => ({ captureError: vi.fn() }));

import { readJsonBody, withAdminRoute, type AdminRouteHandler } from './with-admin-route';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function call<P extends Record<string, string>>(handler: AdminRouteHandler<P>, params = {} as P, init?: RequestInit) {
    return handler(new Request('http://localhost/api/admin/x', init), { params: Promise.resolve(params) });
}

describe('withAdminRoute', () => {
    beforeEach(() => {
        mockRequireAdmin.mockReset();
        mockRequireAdmin.mockResolvedValue({ adminId: ADMIN_ID });
    });

    it('returns the requireAdmin response and never runs the handler for a non-admin', async () => {
        mockRequireAdmin.mockResolvedValue(
            NextResponse.json({ error: 'Accesso non autorizzato.', code: 'FORBIDDEN', status: 403 }, { status: 403 }),
        );
        const handler = vi.fn();
        const response = await call(withAdminRoute('admin/x GET', handler));

        expect(response.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
    });

    it('passes the admin id and params, and marks the response no-store', async () => {
        const route = withAdminRoute<{ id: string }>('admin/x GET', async ({ adminId, params }) =>
            NextResponse.json({ adminId, id: params.id }),
        );
        const response = await call(route, { id: USER_ID });

        expect(await response.json()).toEqual({ adminId: ADMIN_ID, id: USER_ID });
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('x-request-id')).toBeTruthy();
    });

    it('rejects an id param that is not a UUID with a 400, before the handler', async () => {
        const handler = vi.fn();
        const response = await call(withAdminRoute<{ id: string }>('admin/x GET', handler), { id: "1' or '1'='1" });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(handler).not.toHaveBeenCalled();
    });

    it('answers a malformed JSON body with a 400', async () => {
        const route = withAdminRoute('admin/x POST', async ({ request }) => NextResponse.json(await readJsonBody(request)));
        const response = await call(route, {}, { method: 'POST', body: '{not json' });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('hides unexpected errors behind the generic message', async () => {
        const route = withAdminRoute('admin/x GET', async () => {
            throw new Error('relation "secret_table" does not exist');
        });
        const response = await call(route);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(JSON.stringify(body)).not.toContain('secret_table');
    });
});
