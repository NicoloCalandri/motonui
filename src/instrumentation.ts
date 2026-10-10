import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

/**
 * Server and Edge Sentry setup (T-4.2). Next.js calls register() once per
 * runtime at startup; without NEXT_PUBLIC_SENTRY_DSN Sentry stays disabled.
 */
export function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
        Sentry.init(sentryOptions());
    }
}

/** Errors thrown by Server Components, route handlers and middleware. */
export const onRequestError = Sentry.captureRequestError;
