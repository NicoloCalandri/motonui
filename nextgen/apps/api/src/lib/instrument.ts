// env first: it gives the Sentry DSN the name sentry.ts reads.
import './env';
import * as Sentry from '@sentry/node';
import { sentryOptions } from './sentry';

/**
 * Starts Sentry for the API process, with the same scrubbing options as the
 * Next.js app (lib/sentry.ts). Imported first by src/index.ts. Without
 * SENTRY_DSN it stays off and errors are only logged.
 */
Sentry.init(sentryOptions());
