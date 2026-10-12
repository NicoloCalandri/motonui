import { assertNoAdminBypassInProduction } from './auth/admin-bypass';

// The development bypass of the admin checks must never reach production:
// the process refuses to start, like `next build` does for the Next.js app.
assertNoAdminBypassInProduction();

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

export const env = {
    SUPABASE_URL: required('SUPABASE_URL'),
    SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
    ADMIN_IMPERSONATION_SECRET: process.env.ADMIN_IMPERSONATION_SECRET ?? '',
    ENABLE_CRON: process.env.ENABLE_CRON === 'true',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT ?? 3001),
};

// Modules copied from src/lib (scripts/port-lib.mjs) read the Supabase URL
// and the Sentry DSN under the names the Next.js app gives them. The aliases
// here keep the copies identical to their source.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= env.SUPABASE_URL;
if (process.env.SENTRY_DSN) process.env.NEXT_PUBLIC_SENTRY_DSN ??= process.env.SENTRY_DSN;
