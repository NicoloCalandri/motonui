/**
 * ADMIN_AUTH_BYPASS skips the admin checks for local development only
 * (T-1.10, SR-DEV-03). It must never take effect in a production build:
 *   - isAdminAuthBypassEnabled() ignores it (and logs) in production;
 *   - assertNoAdminBypassInProduction() is called by next.config.ts, so
 *     `next build` / `next start` refuse to run with it set.
 * Every Vercel deployment (Production and Preview) builds with
 * NODE_ENV=production, so the bypass can only work under `next dev`.
 */

type Env = Record<string, string | undefined>;

export function isProductionEnvironment(env: Env = process.env): boolean {
    return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview';
}

export function assertNoAdminBypassInProduction(env: Env = process.env): void {
    if (env.ADMIN_AUTH_BYPASS === 'true' && isProductionEnvironment(env)) {
        throw new Error(
            '[motonui] ADMIN_AUTH_BYPASS=true is not allowed in production (NODE_ENV/VERCEL_ENV). ' +
            'Remove it from the environment: it disables every admin authorization check.',
        );
    }
}

export function isAdminAuthBypassEnabled(env: Env = process.env): boolean {
    if (env.ADMIN_AUTH_BYPASS !== 'true') return false;
    if (isProductionEnvironment(env)) {
        // console, not log: this module is also loaded by next.config.ts, outside the app bundle.
        console.error('[motonui][auth] ADMIN_AUTH_BYPASS ignored in production');
        return false;
    }
    return true;
}
