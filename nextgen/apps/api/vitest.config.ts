import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        env: {
            SUPABASE_URL: 'http://127.0.0.1:54321',
            SUPABASE_ANON_KEY: 'test-anon-key',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
            ADMIN_IMPERSONATION_SECRET: 'test-impersonation-secret-32-chars-min',
            ADMIN_AUTH_BYPASS: 'false',
        },
    },
});
