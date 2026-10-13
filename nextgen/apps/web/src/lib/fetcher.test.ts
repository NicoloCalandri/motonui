import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FETCH_ERROR, FetchError, jsonFetcher } from './fetcher';

function respond(status: number, body: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe('jsonFetcher', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('returns the parsed body on 2xx', async () => {
        respond(200, [{ id: 'a' }]);
        await expect(jsonFetcher('/api/x')).resolves.toEqual([{ id: 'a' }]);
    });

    it('throws a FetchError with the API message and status', async () => {
        respond(403, { error: 'Non fai parte di questo viaggio', code: 'FORBIDDEN', status: 403 });
        const err = await jsonFetcher('/api/x').catch((e: unknown) => e);
        expect(err).toBeInstanceOf(FetchError);
        expect(err).toMatchObject({ message: 'Non fai parte di questo viaggio', status: 403 });
    });

    it('falls back to a generic message when the body is not our error format', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
        await expect(jsonFetcher('/api/x')).rejects.toMatchObject({ message: DEFAULT_FETCH_ERROR, status: 502 });
    });
});
