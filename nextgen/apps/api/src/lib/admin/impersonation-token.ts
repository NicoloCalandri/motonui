import { SignJWT, decodeJwt, jwtVerify } from 'jose';

/**
 * Impersonation tokens (T-1.8, ADR-07, SR-AUTHZ-10 / SR-CRYPTO-03 / SR-CRYPTO-04).
 *
 * The token is an HS256 JWT with a random `jti`. The database stores only
 * SHA-256(jti) (impersonation_tokens.token), never the token, and the
 * middleware refuses a token whose jti is no longer stored: exiting an
 * impersonation revokes it immediately (up to REVOCATION_CACHE_MS).
 * Edge-compatible: Web Crypto and fetch only.
 */

export const IMPERSONATION_DURATION_SECONDS = 30 * 60;
export const REVOCATION_CACHE_MS = 30_000;
const MIN_SECRET_LENGTH = 32;

export interface ImpersonationClaims {
    adminId: string;
    targetId: string;
    jti: string;
}

function secretKey(secret: string | undefined): Uint8Array {
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
        throw new Error('[motonui][impersonation] ADMIN_IMPERSONATION_SECRET is missing or too short');
    }
    return new TextEncoder().encode(secret);
}

/** Hex SHA-256 of the token id, the only form stored in the database. */
export async function hashJti(jti: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jti));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createImpersonationToken(
    claims: { adminId: string; targetId: string },
    secret: string | undefined,
): Promise<{ token: string; jti: string; jtiHash: string; expiresAt: Date }> {
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + IMPERSONATION_DURATION_SECONDS * 1000);
    const token = await new SignJWT({ adminId: claims.adminId, targetId: claims.targetId, type: 'impersonation' })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(secretKey(secret));
    return { token, jti, jtiHash: await hashJti(jti), expiresAt };
}

/** Verifies signature, expiry and shape. Returns null for any invalid token. */
export async function verifyImpersonationToken(
    token: string,
    secret: string | undefined,
): Promise<ImpersonationClaims | null> {
    try {
        const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ['HS256'] });
        if (
            payload.type !== 'impersonation' ||
            typeof payload.jti !== 'string' ||
            typeof payload.adminId !== 'string' ||
            typeof payload.targetId !== 'string'
        ) {
            return null;
        }
        return { adminId: payload.adminId, targetId: payload.targetId, jti: payload.jti };
    } catch {
        return null;
    }
}

/** Reads the jti without verifying the token (used only to revoke it on exit). */
export function readJti(token: string): string | null {
    try {
        const { jti } = decodeJwt(token);
        return typeof jti === 'string' ? jti : null;
    } catch {
        return null;
    }
}

const activeCache = new Map<string, { active: boolean; until: number }>();

/** For tests. */
export function clearRevocationCache(): void {
    activeCache.clear();
}

/**
 * True if the token id is still stored and not expired. Queries PostgREST with
 * the service role (impersonation_tokens has no client policies) and caches
 * the answer for REVOCATION_CACHE_MS. Fails closed: any error means revoked.
 */
export async function isImpersonationTokenActive(jti: string, now: number = Date.now()): Promise<boolean> {
    const jtiHash = await hashJti(jti);
    const cached = activeCache.get(jtiHash);
    if (cached && cached.until > now) return cached.active;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let active = false;

    if (url && serviceKey) {
        try {
            const query = new URLSearchParams({
                select: 'id',
                token: `eq.${jtiHash}`,
                expires_at: `gt.${new Date(now).toISOString()}`,
                limit: '1',
            });
            const res = await fetch(`${url}/rest/v1/impersonation_tokens?${query}`, {
                headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
                cache: 'no-store',
            });
            const rows: unknown = res.ok ? await res.json() : null;
            active = Array.isArray(rows) && rows.length > 0;
        } catch {
            active = false;
        }
    }

    activeCache.set(jtiHash, { active, until: now + REVOCATION_CACHE_MS });
    return active;
}
