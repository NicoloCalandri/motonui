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
    ADMIN_AUTH_BYPASS: process.env.ADMIN_AUTH_BYPASS === 'true',
    ADMIN_CLEANUP_SECRET: process.env.ADMIN_CLEANUP_SECRET ?? '',
    ENABLE_CRON: process.env.ENABLE_CRON === 'true',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT ?? 3001),
};
