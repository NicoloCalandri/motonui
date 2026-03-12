/**
 * Sentry monitoring integration for motonui.
 * Tracks errors, performance, and user context.
 */

let sentryInitialized = false;

/**
 * Initialises Sentry once. Safe to call multiple times.
 */
export async function initSentry(): Promise<void> {
    if (sentryInitialized) return;
    if (!process.env.SENTRY_DSN) return;

    // Dynamic import prevents Sentry from increasing client bundle in environments without DSN
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
        // Capture only 10% of replays in production
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
            Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        ],
        beforeSend(event) {
            // Redact personal data
            if (event.user) {
                delete event.user.email;
                delete event.user.ip_address;
            }
            return event;
        },
    });

    sentryInitialized = true;
}

/**
 * Captures a caught exception with optional context.
 */
export async function captureError(
    error: unknown,
    context?: Record<string, unknown>
): Promise<void> {
    if (!process.env.SENTRY_DSN) {
        console.error('[motonui][error]', error);
        return;
    }

    const Sentry = await import('@sentry/nextjs');
    Sentry.withScope((scope) => {
        if (context) {
            scope.setExtras(context);
        }
        Sentry.captureException(error);
    });
}

/**
 * Sets the current authenticated user for Sentry scope.
 */
export async function setUserContext(userId: string): Promise<void> {
    if (!process.env.SENTRY_DSN) return;
    const Sentry = await import('@sentry/nextjs');
    Sentry.setUser({ id: userId });
}
