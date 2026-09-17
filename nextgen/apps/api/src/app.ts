import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { handleImpersonation } from './middleware/impersonation';
import { tripsRouter } from './routes/trips';
import { profileRouter } from './routes/profile';
import { tripsDaysRouter } from './routes/trips-days';
import { tripsLegsRouter, tripsDayLegsRouter } from './routes/trips-legs';
import { tripsAccommodationsRouter, tripsDayAccommodationsRouter } from './routes/trips-accommodations';
import { tripsRestaurantsRouter } from './routes/trips-restaurants';
import { tripsActivitiesRouter } from './routes/trips-activities';
import { tripsDocumentsRouter } from './routes/trips-documents';
import { tripsExpensesRouter } from './routes/trips-expenses';
import { expensesRouter } from './routes/expenses';
import { tripsMediaRouter } from './routes/trips-media';
import { tripsPostsRouter } from './routes/trips-posts';
import { tripsBaggageRouter } from './routes/trips-baggage';
import { tripsPackingRouter } from './routes/trips-packing';
import { tripsStatsRouter } from './routes/trips-stats';
import { aiRouter } from './routes/ai';
import { instagramRouter } from './routes/instagram';
import { postsRouter } from './routes/posts';
import { cleanupRouter } from './routes/admin/cleanup';
import { sendRemindersRouter } from './routes/admin/send-reminders';
import { statsRouter as adminStatsRouter } from './routes/admin/stats';
import { auditLogRouter } from './routes/admin/audit-log';
import { featuresRouter } from './routes/admin/features';
import { usersRouter as adminUsersRouter } from './routes/admin/users';
import { adminTripsRouter } from './routes/admin/trips';
import { impersonateExitRouter } from './routes/admin/impersonate';
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

    // ── Trips + nested resources ────────────────────────────────────────────
    app.route('/api/trips', tripsRouter);
    app.route('/api/trips/:id/days', tripsDaysRouter);
    app.route('/api/trips/:id/legs', tripsLegsRouter);
    app.route('/api/trips/:id/days/:dayId/legs', tripsDayLegsRouter);
    app.route('/api/trips/:id/accommodations', tripsAccommodationsRouter);
    app.route('/api/trips/:id/days/:dayId/accommodations', tripsDayAccommodationsRouter);
    app.route('/api/trips/:id/restaurants', tripsRestaurantsRouter);
    app.route('/api/trips/:id/activities', tripsActivitiesRouter);
    app.route('/api/trips/:id/documents', tripsDocumentsRouter);
    app.route('/api/trips/:id/expenses', tripsExpensesRouter);
    app.route('/api/trips/:id/media', tripsMediaRouter);
    app.route('/api/trips/:id/posts', tripsPostsRouter);
    app.route('/api/trips/:id/baggage', tripsBaggageRouter);
    app.route('/api/trips/:id/packing', tripsPackingRouter);
    app.route('/api/trips/:id/stats', tripsStatsRouter);

    // ── Top-level resources ─────────────────────────────────────────────────
    app.route('/api/expenses', expensesRouter);
    app.route('/api/profile', profileRouter);
    app.route('/api/posts', postsRouter);
    app.route('/api/ai', aiRouter);
    app.route('/api/instagram', instagramRouter);

    // ── Admin ────────────────────────────────────────────────────────────────
    app.route('/api/admin/cleanup', cleanupRouter);
    app.route('/api/admin/send-reminders', sendRemindersRouter);
    app.route('/api/admin/stats', adminStatsRouter);
    app.route('/api/admin/audit-log', auditLogRouter);
    app.route('/api/admin/features', featuresRouter);
    app.route('/api/admin/users', adminUsersRouter);
    app.route('/api/admin/trips', adminTripsRouter);
    app.route('/api/admin/impersonate', impersonateExitRouter);

    return app;
}
