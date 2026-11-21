import { sanitizePlainText } from './sanitize';

/**
 * Free-text search terms that end up inside a PostgREST filter string, such
 * as `.or('email.ilike.%term%,…')`. The client escapes nothing there: a comma
 * starts a new condition and parentheses open a group, so a raw term could add
 * filters of its own (audit A2, query injection). Only letters, digits,
 * spaces and the characters an email or a name needs survive.
 */
const DEFAULT_MAX_LENGTH = 80;

export function normalizeSearchTerm(raw: string | null | undefined, maxLength = DEFAULT_MAX_LENGTH): string {
    if (!raw) return '';
    return sanitizePlainText(raw, maxLength)
        .replace(/[^\p{L}\p{N}\s@.+'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** `col1.ilike.%term%,col2.ilike.%term%` for `.or()`, on a term already normalized. */
export function ilikeAnyFilter(columns: readonly string[], term: string): string {
    const safe = normalizeSearchTerm(term);
    return columns.map((column) => `${column}.ilike.%${safe}%`).join(',');
}
