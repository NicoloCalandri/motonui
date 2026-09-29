// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeFetch, SafeFetchError } from './safe-fetch';

const ALLOWED = ['api.example.com'];

describe('safeFetch', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockResolvedValue(new Response('ok'));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it('fetches an allowlisted HTTPS host without following redirects and with a timeout', async () => {
        await safeFetch('https://api.example.com/v1?q=1', { allowedHosts: ALLOWED });

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://api.example.com/v1?q=1');
        expect(init.redirect).toBe('error');
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it.each([
        ['host not in the allowlist', 'https://evil.example.com/'],
        ['suffix trick', 'https://api.example.com.evil.io/'],
        ['plain http', 'http://api.example.com/'],
        ['credentials', 'https://user:pass@api.example.com/'],
        ['non standard port', 'https://api.example.com:8443/'],
        ['internal address', 'https://169.254.169.254/latest/meta-data'],
        ['not a URL', 'not a url'],
    ])('rejects %s', async (_, url) => {
        await expect(safeFetch(url, { allowedHosts: ALLOWED })).rejects.toBeInstanceOf(SafeFetchError);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
