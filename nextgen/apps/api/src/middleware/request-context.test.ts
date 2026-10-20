import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { Errors } from '../lib/errors';
import { withErrorHandler } from '../lib/http';

// Built from parts so the secret scanner does not read the fake token as a real one.
const FAKE_JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTYifQ', 'c2lnbmF0dXJlLWJ5dGVz'].join('.');
const SECRET_MESSAGE = `boom user@example.com ${FAKE_JWT}`;

function appWithProbes() {
    const app = createApp();
    app.get('/api/__boom', () => {
        throw new Error(SECRET_MESSAGE);
    });
    app.get('/api/__wrapped', withErrorHandler(async () => {
        throw new Error(SECRET_MESSAGE);
    }, 'probe GET'));
    app.get('/api/__forbidden', withErrorHandler(async () => {
        throw Errors.forbidden();
    }, 'probe GET'));
    return app;
}

describe('request context and error boundary', () => {
    afterEach(() => vi.restoreAllMocks());

    it('puts an x-request-id on every response, 404 included', async () => {
        const app = createApp();
        const health = await app.request('/api/health');
        const missing = await app.request('/api/does-not-exist');

        expect(health.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
        expect(missing.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
        expect(health.headers.get('x-request-id')).not.toBe(missing.headers.get('x-request-id'));
    });

    it('reuses a well-formed incoming id and replaces a malformed one', async () => {
        const app = createApp();
        const reused = await app.request('/api/health', { headers: { 'x-request-id': 'edge-123:abc' } });
        const replaced = await app.request('/api/health', { headers: { 'x-request-id': 'a b<script>' } });

        expect(reused.headers.get('x-request-id')).toBe('edge-123:abc');
        expect(replaced.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('answers an unknown path with the standard 404 body', async () => {
        const res = await createApp().request('/api/does-not-exist');

        expect(res.status).toBe(404);
        expect(await res.json()).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });

    it.each(['/api/__boom', '/api/__wrapped'])('hides an unexpected error from the client and redacts it in the log (%s)', async (path) => {
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await appWithProbes().request(path);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body).toEqual({ error: 'Ops! Qualcosa è andato storto 🏝️', code: 'INTERNAL_ERROR', status: 500 });

        expect(errorLog).toHaveBeenCalledTimes(1);
        const line = errorLog.mock.calls[0][0] as string;
        const entry = JSON.parse(line);
        expect(entry.level).toBe('error');
        expect(entry.request_id).toBe(res.headers.get('x-request-id'));
        expect(line).not.toContain('user@example.com');
        expect(line).not.toContain('eyJhbGciOiJIUzI1NiJ9');
        expect(line).toContain('[email]');
    });

    it('logs an expected AppError as a warning with its code, and keeps its message for the client', async () => {
        const warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await appWithProbes().request('/api/__forbidden');

        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: 'FORBIDDEN', status: 403 });
        expect(errorLog).not.toHaveBeenCalled();
        const entry = JSON.parse(warnLog.mock.calls[0][0] as string);
        expect(entry.request_id).toBe(res.headers.get('x-request-id'));
        expect(JSON.stringify(entry)).toContain('FORBIDDEN');
    });
});
