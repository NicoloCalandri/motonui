const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/** Escapes text for HTML element content and quoted attribute values. */
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

type Escaped<T> = { [K in keyof T]: T[K] extends string ? string : T[K] };

/**
 * Returns a copy of `fields` with every string value HTML-escaped (other
 * values unchanged). For building HTML templates from user-provided data.
 */
export function escapeFields<T extends object>(fields: T): Escaped<T> {
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]),
    ) as Escaped<T>;
}
