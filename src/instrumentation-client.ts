import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

/**
 * Browser Sentry setup (T-4.2). No session replay: it would record trip
 * content and personal data on screen.
 */
Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
