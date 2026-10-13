import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { handleImpersonation } from './middleware/impersonation';
import { corsPolicy, noStore, rejectCrossSiteWrites } from './middleware/origin';
import { rateLimit, rateLimitByIp } from './middleware/rate-limit';
import { handleAppError, handleNotFound, requestContext } from './middleware/request-context';
import { requireUser } from './middleware/auth';
import { tripGuard } from './middleware/trip-guard';
import { tripsRouter } from './routes/trips';
import { profileRouter } from './routes/profile';
import { accountRouter } from './routes/account';
import { sessionRouter } from './routes/session';
import { invitesRouter } from './routes/invites';
import { tripsInvitesRouter } from './routes/trips-invites';
import { tripsDaysRouter } from './routes/trips-days';
import { tripsLegsRouter, tripsDayLegsRouter } from './routes/trips-legs';
import { tripsBoardingPassRouter } from './routes/trips-boarding-pass';
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
import { tripsInstagramRouter } from './routes/trips-instagram';
import { sentryTestRouter } from './routes/admin/sentry-test';
import { postsRouter } from './routes/posts';
import { cleanupRouter } from './routes/admin/cleanup';
import { sendRemindersRouter } from './routes/admin/send-reminders';
import { statsRouter as adminStatsRouter } from './routes/admin/stats';
import { auditLogRouter } from './routes/admin/audit-log';
import { featuresRouter } from './routes/admin/features';
import { usersRouter as adminUsersRouter } from './routes/admin/users';
import { adminTripsRouter } from './routes/admin/trips';
import { impersonateExitRouter } from './routes/admin/impersonate';
import type { AppEnv } from './types';

export function createApp() {
    const app = new Hono<AppEnv>();

    // First, so every log line and every response (errors included) carries the request id.
    app.use('*', requestContext);
    app.onError(handleAppError);
    app.notFound(handleNotFound);

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

    // Only the web app's origins (WEB_ORIGIN) may read responses or send writes.
    app.use('/api/*', corsPolicy);
    app.use('/api/*', rejectCrossSiteWrites);
    app.use('/api/*', noStore);

    app.use('/api/*', handleImpersonation);

    app.get('/api/health', (c) => c.json({ ok: true }));

    // ── Trips + nested resources ────────────────────────────────────────────
    // Membership is checked here for everything under a trip, before any router.
    app.use('/api/trips/:id', ...tripGuard);
    app.use('/api/trips/:id/*', ...tripGuard);

    // Abuse limits (lib/rate-limit.ts), declared here like the trip guard so a
    // router cannot forget them. Buckets mirror the Next.js routes.
    app.use('/api/trips/:id/media/uploads', rateLimit('mediaUpload'));
    app.use('/api/trips/:id/media/confirm', rateLimit('mediaUpload'));
    app.use('/api/trips/:id/documents', rateLimit('fileUpload'));
    app.use('/api/trips/:id/days/:dayId/legs/:legId/boarding-pass', rateLimit('fileUpload'));
    app.use('/api/trips/:id/packing', rateLimit('ai'));
    app.use('/api/trips/:id/instagram/exports', rateLimit('instagramExport'));
    app.use('/api/profile/avatar', requireUser, rateLimit('fileUpload'));
    app.use('/api/ai/*', requireUser, rateLimit('ai'));
    app.use('/api/posts/:slug', rateLimitByIp('publicPost'));

    app.route('/api/trips', tripsRouter);
    app.route('/api/trips/:id/days', tripsDaysRouter);
    app.route('/api/trips/:id/legs', tripsLegsRouter);
    app.route('/api/trips/:id/days/:dayId/legs', tripsDayLegsRouter);
    app.route('/api/trips/:id/days/:dayId/legs', tripsBoardingPassRouter);
    app.route('/api/trips/:id/accommodations', tripsAccommodationsRouter);
    app.route('/api/trips/:id/days/:dayId/accommodations', tripsDayAccommodationsRouter);
    app.route('/api/trips/:id/restaurants', tripsRestaurantsRouter);
    app.route('/api/trips/:id/activities', tripsActivitiesRouter);
    app.route('/api/trips/:id/documents', tripsDocumentsRouter);
    app.route('/api/trips/:id/invites', tripsInvitesRouter);
    app.route('/api/trips/:id/instagram', tripsInstagramRouter);
    app.route('/api/trips/:id/expenses', tripsExpensesRouter);
    app.route('/api/trips/:id/media', tripsMediaRouter);
    app.route('/api/trips/:id/posts', tripsPostsRouter);
    app.route('/api/trips/:id/baggage', tripsBaggageRouter);
    app.route('/api/trips/:id/packing', tripsPackingRouter);
    app.route('/api/trips/:id/stats', tripsStatsRouter);

    // ── Top-level resources ─────────────────────────────────────────────────
    app.route('/api/expenses', expensesRouter);
    app.route('/api/profile', profileRouter);
    app.route('/api/account', accountRouter);
    app.route('/api/session', sessionRouter);
    app.route('/api/invites', invitesRouter);
    app.route('/api/posts', postsRouter);
    app.route('/api/ai', aiRouter);

    // ── Admin ────────────────────────────────────────────────────────────────
    app.route('/api/admin/cleanup', cleanupRouter);
    app.route('/api/admin/send-reminders', sendRemindersRouter);
    app.route('/api/admin/stats', adminStatsRouter);
    app.route('/api/admin/sentry-test', sentryTestRouter);
    app.route('/api/admin/audit-log', auditLogRouter);
    app.route('/api/admin/features', featuresRouter);
    app.route('/api/admin/users', adminUsersRouter);
    app.route('/api/admin/trips', adminTripsRouter);
    app.route('/api/admin/impersonate', impersonateExitRouter);

    return app;
}
