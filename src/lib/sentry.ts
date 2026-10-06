import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import { redactText } from './redact';

/**
 * Shared Sentry options for the browser, Node and Edge runtimes (T-4.2,
 * SR-OPS-01). One variable, NEXT_PUBLIC_SENTRY_DSN, enables all three; without
 * it Sentry stays off. No session replay and no default PII: events are
 * scrubbed of emails, tokens, cookies, headers and request bodies before
 * they leave the process.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

const KEPT_HEADERS = new Set(['user-agent', 'x-request-id', 'x-vercel-id']);

function redactUnknown(value: unknown): unknown {
    if (typeof value === 'string') return redactText(value);
    if (Array.isArray(value)) return value.map(redactUnknown);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, redactUnknown(v)]));
    }
    return value;
}

/** beforeSend: keeps only what is needed to debug, without personal data. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
    if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
    if (event.message) event.message = redactText(event.message);

    for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = redactText(exception.value);
    }

    if (event.request) {
        const { url, method, headers } = event.request;
        event.request = {
            method,
            url: url ? redactText(url.split('?')[0]) : undefined,
            headers: headers
                ? Object.fromEntries(Object.entries(headers).filter(([key]) => KEPT_HEADERS.has(key.toLowerCase())))
                : undefined,
        };
    }

    if (event.extra) event.extra = redactUnknown(event.extra) as ErrorEvent['extra'];
    if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
    return event;
}

/** beforeBreadcrumb: no request bodies, no query strings, redacted messages. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
    const scrubbed: Breadcrumb = { ...breadcrumb };
    if (scrubbed.message) scrubbed.message = redactText(scrubbed.message);
    if (scrubbed.data) {
        const data: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(scrubbed.data)) {
            if (key === 'body' || key === 'arguments') continue;
            data[key] = typeof value === 'string' && (key === 'url' || key === 'to' || key === 'from')
                ? redactText(value.split('?')[0])
                : redactUnknown(value);
        }
        scrubbed.data = data;
    }
    return scrubbed;
}

export function sentryOptions() {
    return {
        dsn: SENTRY_DSN,
        enabled: Boolean(SENTRY_DSN),
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        sendDefaultPii: false,
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
    };
}
