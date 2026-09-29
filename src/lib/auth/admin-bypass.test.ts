import { describe, expect, it, vi } from 'vitest';
import { assertNoAdminBypassInProduction, isAdminAuthBypassEnabled } from './admin-bypass';

describe('ADMIN_AUTH_BYPASS guard', () => {
    it('is enabled only when explicitly set outside production', () => {
        expect(isAdminAuthBypassEnabled({ ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'development' })).toBe(true);
        expect(isAdminAuthBypassEnabled({ NODE_ENV: 'development' })).toBe(false);
        expect(isAdminAuthBypassEnabled({ ADMIN_AUTH_BYPASS: '1', NODE_ENV: 'development' })).toBe(false);
    });

    it.each([
        { ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'production' },
        { ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'development', VERCEL_ENV: 'production' },
        { ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'development', VERCEL_ENV: 'preview' },
    ])('is ignored and logged in production (%o)', (env) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(isAdminAuthBypassEnabled(env)).toBe(false);
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });

    it('blocks build/start in production and allows it otherwise', () => {
        expect(() => assertNoAdminBypassInProduction({ ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'production' })).toThrow(/not allowed in production/);
        expect(() => assertNoAdminBypassInProduction({ NODE_ENV: 'production' })).not.toThrow();
        expect(() => assertNoAdminBypassInProduction({ ADMIN_AUTH_BYPASS: 'true', NODE_ENV: 'development' })).not.toThrow();
    });
});
