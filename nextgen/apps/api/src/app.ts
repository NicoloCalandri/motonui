import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { handleImpersonation } from './middleware/impersonation';
import { tripsRouter } from './routes/trips';
import { env } from './lib/env';
import type { AppEnv } from './types';

export function createApp() {
    const app = new Hono<AppEnv>();

    // Direct port of the securityHeaders list in next.config.ts.
    app.use(
        '*',
        secureHeaders({
            xContentTypeOptions: 'nosniff',
            xFrameOptions: 'DENY',
            referrerPolicy: 'strict-origin-when-cross-origin',
            strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
        })
    );

    // Same-origin deploy is the target (see plan §Hosting); CORS is only
    // relevant for local dev where apps/web runs on a different Vite port.
    app.use(
        '/api/*',
        cors({
            origin: env.NODE_ENV === 'development' ? 'http://localhost:5173' : (origin) => origin,
            credentials: true,
        })
    );

    app.use('/api/*', handleImpersonation);

    app.get('/api/health', (c) => c.json({ ok: true }));

    app.route('/api/trips', tripsRouter);

    return app;
}
