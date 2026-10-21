import { sanitizePlainText } from '@/lib/sanitize';

const MAX_QUERY_LENGTH = 80;

/**
 * Normalizes the `q` search param: plain text, letters, digits, spaces and
 * a few separators only. Everything else (commas, parentheses, quotes, the
 * `%`/`_`/`*` wildcards) would change the meaning of the PostgREST filter.
 */
export function normalizeTripQuery(raw: string | string[] | undefined): string {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) return '';
    return sanitizePlainText(value, MAX_QUERY_LENGTH)
        .replace(/[^\p{L}\p{N}\s'.-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** PostgREST `or` filter on the embedded trip: title or destination contains the query. */
export function tripSearchFilter(query: string): string {
    return `title.ilike.%${query}%,destination.ilike.%${query}%`;
}
