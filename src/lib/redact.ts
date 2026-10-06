/**
 * Redaction for logs and error reports (T-4.2, T-4.3, SR-PRIV-05): strips
 * email addresses and anything that looks like a credential before text
 * leaves the server. Trip content never goes to logs by construction (see
 * src/lib/log.ts); this catches what slips in through error messages.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** JWTs (Supabase access tokens, impersonation tokens). */
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;
/** Sensitive query or form parameters: invite tokens, OAuth codes, keys. */
const SECRET_PARAM = /\b(token|code|access_token|refresh_token|api_key|apikey|key|secret|password|signature)=([^&\s"']+)/gi;
/** Long opaque strings: invite tokens (43 base64url chars), API keys, hashes. */
const OPAQUE = /\b[A-Za-z0-9_-]{32,}\b/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function redactText(text: string): string {
    return text
        .replace(JWT, '[token]')
        .replace(BEARER, '$1 [token]')
        .replace(SECRET_PARAM, '$1=[redacted]')
        .replace(EMAIL, '[email]')
        // UUIDs (row ids) stay: they identify records, not people or secrets.
        .replace(OPAQUE, (match) => (UUID.test(match) ? match : '[token]'));
}
