import { redactText } from './redact';

/**
 * Structured server logs (T-4.3, SR-PRIV-05): one JSON line per event with
 * level, message, request id and details. Details are reduced to safe
 * primitives and redacted (emails, tokens); objects are kept one level deep,
 * so a row or a request body cannot be dumped whole by accident.
 *
 *   log.error('[motonui][storage][delete] media', error.message);
 *   → {"level":"error","msg":"[motonui][storage][delete] media","request_id":"…","details":["…"]}
 *
 * Never pass trip content (titles, places, notes, captions) or emails:
 * log ids, counts and error messages.
 */

type Level = 'info' | 'warn' | 'error';
type Primitive = string | number | boolean | null;
type Detail = Primitive | Record<string, Primitive>;

let requestIdProvider: () => string | undefined = () => undefined;

/** Lets the request context (Node runtime only) supply the current request id. */
export function setRequestIdProvider(provider: () => string | undefined): void {
    requestIdProvider = provider;
}

function primitive(value: unknown): Primitive {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return redactText(value).slice(0, 500);
    if (value instanceof Error) return redactText(`${value.name}: ${value.message}`).slice(0, 500);
    if (Array.isArray(value)) return `[array(${value.length})]`;
    return '[object]';
}

/** Reduces one detail to something safe to print. */
export function toDetail(value: unknown): Detail {
    if (value instanceof Error || value === null || typeof value !== 'object' || Array.isArray(value)) {
        return primitive(value);
    }
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, primitive(v)]));
}

function emit(level: Level, message: string, details: unknown[]): void {
    const entry: Record<string, unknown> = { level, msg: redactText(message) };
    const requestId = requestIdProvider();
    if (requestId) entry.request_id = requestId;
    if (details.length > 0) entry.details = details.map(toDetail);
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
}

export const log = {
    info: (message: string, ...details: unknown[]) => emit('info', message, details),
    warn: (message: string, ...details: unknown[]) => emit('warn', message, details),
    error: (message: string, ...details: unknown[]) => emit('error', message, details),
};
