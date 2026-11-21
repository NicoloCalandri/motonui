import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserSessionCookieOptions, serverSessionCookieOptions, sessionCookieOptions } from './cookie-options';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('session cookie options', () => {
    it('are SameSite=Lax on the whole site', () => {
        expect(sessionCookieOptions(true)).toEqual({ path: '/', sameSite: 'lax', secure: true, httpOnly: false });
    });

    it('are Secure on the server in production only', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(serverSessionCookieOptions().secure).toBe(true);
        vi.stubEnv('NODE_ENV', 'development');
        expect(serverSessionCookieOptions().secure).toBe(false);
    });

    it('follow the page protocol in the browser', () => {
        // The test environment serves pages over http://localhost.
        expect(browserSessionCookieOptions().secure).toBe(window.location.protocol === 'https:');
    });
});
