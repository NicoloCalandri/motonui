export const DEFAULT_REDIRECT_PATH = '/dashboard';

// Placeholder origin used only to resolve and normalize the candidate path.
const RESOLVE_ORIGIN = 'http://motonui.invalid';

/**
 * Returns `value` only if it is a same-origin relative path (a single leading
 * `/`), otherwise the fallback. Blocks open redirects such as `https://x`,
 * `//x`, `/\x` and `javascript:` URLs.
 */
export function safeRedirectPath(
    value: string | null | undefined,
    fallback: string = DEFAULT_REDIRECT_PATH,
): string {
    if (!value) return fallback;

    const candidate = value.trim();

    // Must start with exactly one forward slash; `//` and `/\` are
    // protocol-relative in browsers.
    if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
        return fallback;
    }

    // Reject control characters and backslashes anywhere: browsers strip or
    // normalize them, which can turn a path into a different host.
    if (/[\u0000-\u001f\u007f\\]/.test(candidate)) {
        return fallback;
    }

    try {
        const resolved = new URL(candidate, RESOLVE_ORIGIN);
        if (resolved.origin !== RESOLVE_ORIGIN) return fallback;
        return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
        return fallback;
    }
}
