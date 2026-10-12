import { Hono } from 'hono';
import { withErrorHandler } from '../../lib/http';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import type { AppEnv } from '../../types';

export const sentryTestRouter = new Hono<AppEnv>();

/**
 * GET /api/admin/sentry-test — throws on purpose so an admin can check the
 * Sentry setup after a deploy. The message carries a fake email and token:
 * the event in Sentry must show them as [email] and [token].
 */
sentryTestRouter.get(
    '/',
    requireUser,
    loadProfile,
    requireAdmin,
    withErrorHandler(async () => {
        throw new Error('Sentry test: scrubbing check for test@example.com with key api_key=not-a-real-key');
    }, 'admin/sentry-test GET')
);
