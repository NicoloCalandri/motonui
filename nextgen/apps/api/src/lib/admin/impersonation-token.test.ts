// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
    clearRevocationCache,
    createImpersonationToken,
    hashJti,
    isImpersonationTokenActive,
    readJti,
    REVOCATION_CACHE_MS,
    verifyImpersonationToken,
} from './impersonation-token';

const SECRET = 'unit-test-impersonation-secret-0123456789';

describe('impersonation tokens', () => {
    it('round-trips claims and stores only a hash of the jti', async () => {
        const { token, jti, jtiHash } = await createImpersonationToken({ adminId: 'a', targetId: 't' }, SECRET);

        expect(await verifyImpersonationToken(token, SECRET)).toEqual({ adminId: 'a', targetId: 't', jti });
        expect(jtiHash).toMatch(/^[0-9a-f]{64}$/);
        expect(jtiHash).toBe(await hashJti(jti));
        expect(jtiHash).not.toContain(jti);
        expect(token).not.toContain(jtiHash);
    });

    it('rejects a token signed with another secret, expired, or without jti/type', async () => {
        const { token } = await createImpersonationToken({ adminId: 'a', targetId: 't' }, SECRET);
        expect(await verifyImpersonationToken(token, 'another-secret-that-is-long-enough-000')).toBeNull();

        const key = new TextEncoder().encode(SECRET);
        const expired = await new SignJWT({ adminId: 'a', targetId: 't', type: 'impersonation' })
            .setProtectedHeader({ alg: 'HS256' }).setJti('x').setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(key);
        expect(await verifyImpersonationToken(expired, SECRET)).toBeNull();

        const noJti = await new SignJWT({ adminId: 'a', targetId: 't', type: 'impersonation' })
            .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('5m').sign(key);
        expect(await verifyImpersonationToken(noJti, SECRET)).toBeNull();

        const wrongType = await new SignJWT({ adminId: 'a', targetId: 't', type: 'session' })
            .setProtectedHeader({ alg: 'HS256' }).setJti('x').setExpirationTime('5m').sign(key);
        expect(await verifyImpersonationToken(wrongType, SECRET)).toBeNull();
    });

    it('refuses to sign or verify with a short secret', async () => {
        await expect(createImpersonationToken({ adminId: 'a', targetId: 't' }, 'short')).rejects.toThrow();
        expect(await verifyImpersonationToken('x.y.z', 'short')).toBeNull();
    });

    it('reads the jti of an expired token for revocation', async () => {
        const key = new TextEncoder().encode(SECRET);
        const expired = await new SignJWT({ type: 'impersonation' })
            .setProtectedHeader({ alg: 'HS256' }).setJti('old-jti').setExpirationTime(1).sign(key);
        expect(readJti(expired)).toBe('old-jti');
        expect(readJti('garbage')).toBeNull();
    });
});

describe('isImpersonationTokenActive', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        clearRevocationCache();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        fetchMock.mockReset();
    });

    it('is active while the hashed jti is stored, queried with the service role', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));

        expect(await isImpersonationTokenActive('jti-1', 1_000)).toBe(true);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/rest/v1/impersonation_tokens?');
        expect(url).toContain(`token=eq.${await hashJti('jti-1')}`);
        expect(url).not.toContain('jti-1');
        expect(init.headers).toMatchObject({ apikey: 'service-key' });
    });

    it('is revoked when the row is gone (exit) and caches the answer briefly', async () => {
        fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));

        expect(await isImpersonationTokenActive('jti-2', 1_000)).toBe(false);
        expect(await isImpersonationTokenActive('jti-2', 1_000 + REVOCATION_CACHE_MS - 1)).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await isImpersonationTokenActive('jti-2', 1_000 + REVOCATION_CACHE_MS + 1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('fails closed on errors or missing configuration', async () => {
        fetchMock.mockRejectedValue(new Error('network'));
        expect(await isImpersonationTokenActive('jti-3', 1_000)).toBe(false);

        fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
        expect(await isImpersonationTokenActive('jti-4', 1_000)).toBe(false);

        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
        expect(await isImpersonationTokenActive('jti-5', 1_000)).toBe(false);
    });
});
