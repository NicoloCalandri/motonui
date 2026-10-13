import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase-client', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import { withApiAuth } from './api-auth';

const ORIGIN = 'https://motonui.app';

function setup(token: string | null = 'token-1') {
    const inner = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'));
    const getToken = vi.fn(async () => token);
    const authed = withApiAuth(inner as unknown as typeof fetch, getToken, ORIGIN);
    const sent = () => {
        const [input, init] = inner.mock.calls[0];
        return new Request(input instanceof Request ? input : new Request(new URL(String(input), ORIGIN), init)).headers.get('authorization')
            ?? new Headers(init?.headers).get('authorization');
    };
    return { inner, getToken, authed, sent };
}

describe('withApiAuth', () => {
    it.each([
        '/api/trips',
        '/api/trips/abc/packing?x=1',
        `${ORIGIN}/api/profile`,
    ])('adds the session token to %s', async (url) => {
        const { authed, sent } = setup();

        await authed(url, { method: 'POST', body: '{}' });

        expect(sent()).toBe('Bearer token-1');
    });

    it('adds it to a Request object and to a URL object', async () => {
        const first = setup();
        await first.authed(new Request(`${ORIGIN}/api/trips`));
        expect(first.sent()).toBe('Bearer token-1');

        const second = setup();
        await second.authed(new URL('/api/trips', ORIGIN));
        expect(second.sent()).toBe('Bearer token-1');
    });

    it.each([
        'https://evil.example/api/trips',
        'https://motonui.app.evil.example/api/trips',
        'https://api.mapbox.com/geocoding/v5/x.json',
        '//evil.example/api/trips',
        '/apis/other',
        '/assets/logo.svg',
        '/blog/api/x',
        'https://abc.supabase.co/storage/v1/object/upload/sign/trip-media/x?token=y',
    ])('never sends the token to %s', async (url) => {
        const { authed, sent, getToken } = setup();

        await authed(url);

        expect(sent()).toBeNull();
        expect(getToken).not.toHaveBeenCalled();
    });

    it('keeps an Authorization header the caller set', async () => {
        const { authed, sent } = setup();

        await authed('/api/trips', { headers: { Authorization: 'Bearer explicit' } });

        expect(sent()).toBe('Bearer explicit');
    });

    it('sends the request without a token when there is no session', async () => {
        const { authed, sent, inner } = setup(null);

        await authed('/api/posts/some-slug');

        expect(inner).toHaveBeenCalledTimes(1);
        expect(sent()).toBeNull();
    });

    it('asks for the token at each request, so a refreshed one is used', async () => {
        const inner = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'));
        const getToken = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
        const authed = withApiAuth(inner as unknown as typeof fetch, getToken, ORIGIN);

        await authed('/api/trips');
        await authed('/api/trips');

        expect(new Headers(inner.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer new');
    });

    it('keeps the other options of the request', async () => {
        const { authed, inner } = setup();
        const body = new FormData();

        await authed('/api/trips/abc/documents', { method: 'POST', body });

        const [, init] = inner.mock.calls[0];
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(body);
        expect(new Headers(init?.headers).has('content-type')).toBe(false);
    });
});
