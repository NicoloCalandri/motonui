import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './sentry';

describe('Sentry scrubbing (T-4.2)', () => {
    it('removes personal data and credentials from an error event', () => {
        const event: ErrorEvent = {
            type: undefined,
            message: 'invite for giorgia@example.com failed',
            user: { id: 'u-1', email: 'nicolo@example.com', ip_address: '1.2.3.4' },
            exception: { values: [{ type: 'Error', value: 'JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlX3ZhbHVl rejected' }] },
            request: {
                method: 'POST',
                url: 'https://motonui.app/api/invites/accept?token=secret',
                headers: { cookie: 'sb-access-token=x', authorization: 'Bearer y', 'user-agent': 'Safari' },
                data: { email: 'giorgia@example.com' },
                cookies: { 'sb-access-token': 'x' },
            },
            extra: { note: 'mail nicolo@example.com', nested: { key: 'api_key=abc' } },
        };

        const scrubbed = scrubEvent(event);

        expect(scrubbed.user).toEqual({ id: 'u-1' });
        expect(scrubbed.message).toBe('invite for [email] failed');
        expect(scrubbed.exception?.values?.[0].value).toBe('JWT [token] rejected');
        expect(scrubbed.request).toEqual({
            method: 'POST',
            url: 'https://motonui.app/api/invites/accept',
            headers: { 'user-agent': 'Safari' },
        });
        expect(scrubbed.extra).toEqual({ note: 'mail [email]', nested: { key: 'api_key=[redacted]' } });
    });

    it('drops bodies and query strings from breadcrumbs', () => {
        expect(scrubBreadcrumb({
            category: 'fetch',
            message: 'POST giorgia@example.com',
            data: { url: '/api/trips?code=abc', method: 'POST', body: '{"title":"Rapa Nui"}', status_code: 201 },
        })).toEqual({
            category: 'fetch',
            message: 'POST [email]',
            data: { url: '/api/trips', method: 'POST', status_code: 201 },
        });
    });
});
