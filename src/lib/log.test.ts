// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, toDetail } from './log';
import { requestIdFrom, runWithRequestId } from './request-context';

describe('log', () => {
    afterEach(() => vi.restoreAllMocks());

    it('writes one JSON line with the request id of the current request', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        runWithRequestId('req-1', () => log.error('[motonui][test] failed', new Error('boom for giorgia@example.com')));

        expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
            level: 'error',
            msg: '[motonui][test] failed',
            request_id: 'req-1',
            details: ['Error: boom for [email]'],
        });
    });

    it('omits the request id outside a request', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        log.info('[motonui][cron] done', { sent: 2 });
        expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({ level: 'info', msg: '[motonui][cron] done', details: [{ sent: 2 }] });
    });

    it('keeps objects one level deep and never dumps nested content', () => {
        expect(toDetail({ id: 'r-1', trip: { title: 'Rapa Nui' }, tags: ['a'], ok: true })).toEqual({
            id: 'r-1', trip: '[object]', tags: '[array(1)]', ok: true,
        });
        expect(toDetail(undefined)).toBeNull();
    });
});

describe('requestIdFrom', () => {
    it('reuses a well-formed upstream id and replaces anything else', () => {
        expect(requestIdFrom(new Request('http://x', { headers: { 'x-vercel-id': 'fra1::abc-123' } }))).toBe('fra1::abc-123');
        const fresh = requestIdFrom(new Request('http://x', { headers: { 'x-request-id': 'bad id <script>' } }));
        expect(fresh).toMatch(/^[0-9a-f-]{36}$/);
    });
});
