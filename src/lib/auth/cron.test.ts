// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAuthorizedCronRequest } from './cron';

const SECRET = 'cron-secret-for-unit-tests-0123456789';

function request(authorization?: string) {
    return new Request('https://motonui.app/api/admin/cleanup', {
        headers: authorization ? { authorization } : {},
    });
}

describe('isAuthorizedCronRequest', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('accepts the Vercel Cron bearer header', () => {
        vi.stubEnv('CRON_SECRET', SECRET);
        expect(isAuthorizedCronRequest(request(`Bearer ${SECRET}`))).toBe(true);
    });

    it('rejects a missing, wrong or differently formatted header', () => {
        vi.stubEnv('CRON_SECRET', SECRET);
        expect(isAuthorizedCronRequest(request())).toBe(false);
        expect(isAuthorizedCronRequest(request(`Bearer ${SECRET}x`))).toBe(false);
        expect(isAuthorizedCronRequest(request(SECRET))).toBe(false);
        expect(isAuthorizedCronRequest(request(`Basic ${SECRET}`))).toBe(false);
    });

    it('fails closed when CRON_SECRET is missing or too short', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubEnv('CRON_SECRET', '');
        expect(isAuthorizedCronRequest(request('Bearer '))).toBe(false);
        vi.stubEnv('CRON_SECRET', 'short');
        expect(isAuthorizedCronRequest(request('Bearer short'))).toBe(false);
    });
});
