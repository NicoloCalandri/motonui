import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { withErrorHandler } from '@/lib/errors';

/**
 * GET /api/admin/sentry-test — throws on purpose so an admin can check the
 * Sentry setup after a deploy (T-4.2). The message carries a fake email and
 * token: the event in Sentry must show them as [email] and [token].
 */
export const GET = withErrorHandler(async () => {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    throw new Error('Sentry test: scrubbing check for test@example.com with key api_key=not-a-real-key');
}, 'admin/sentry-test GET');
