import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';
import { log } from './log';
import { createAdminClient } from './supabase/server';
import type { Database } from './supabase/database.types';

/**
 * Rate limiting for the public blog API and the expensive routes (T-4.5,
 * SR-WEB-06). Fixed windows counted atomically in Postgres
 * (check_rate_limit, migration 0024) with the service role. Signed-in
 * routes are keyed by user id, the public one by a hash of the IP (never
 * stored in clear). Over the limit: 429 with Retry-After.
 *
 * Limits sit above normal use (a couple uploading a whole day of photos)
 * and well below what a script can send; the AI routes also keep their
 * daily quota (requireFeatureAccess).
 */
export const RATE_LIMITS = {
    /** GET /api/posts/[slug], per IP. */
    publicPost: { limit: 60, windowSeconds: 60 },
    /** Signed upload URLs and confirmations, per user. */
    mediaUpload: { limit: 300, windowSeconds: 3600 },
    /** Document and boarding pass uploads, avatar, per user. */
    fileUpload: { limit: 60, windowSeconds: 3600 },
    /** Instagram ZIP exports, per user. */
    instagramExport: { limit: 10, windowSeconds: 3600 },
    /** AI calls: burst limit on top of the daily quota, per user. */
    ai: { limit: 10, windowSeconds: 60 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export class RateLimitError extends AppError {
    constructor(readonly retryAfterSeconds: number) {
        super('Stai andando troppo veloce! Riprova tra qualche istante 🏝️', 'TOO_MANY_REQUESTS', 429);
        this.name = 'RateLimitError';
        this.headers = { 'Retry-After': String(retryAfterSeconds) };
    }
}

/** Client IP from the proxy headers (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Pseudonymous key for an IP: the address itself is never stored. */
export function ipSubject(request: Request): string {
    return `ip:${createHash('sha256').update(clientIp(request)).digest('hex').slice(0, 32)}`;
}

export function userSubject(userId: string): string {
    return `user:${userId}`;
}

/**
 * Counts one hit for `subject` in `bucket`; throws RateLimitError over the
 * limit. Fails open: if the counter is unavailable the request goes through
 * and the error is logged, so an outage of the limiter does not take the
 * app down with it.
 */
export async function enforceRateLimit(
    bucket: RateLimitBucket,
    subject: string,
    deps: { admin?: SupabaseClient<Database>; now?: Date } = {},
): Promise<void> {
    const { limit, windowSeconds } = RATE_LIMITS[bucket];
    const admin = deps.admin ?? (await createAdminClient());
    const now = deps.now ?? new Date();
    const { data, error } = await admin.rpc('check_rate_limit', {
        p_key: `${subject}:${bucket}`,
        p_limit: limit,
        p_window_seconds: windowSeconds,
    });

    const result = Array.isArray(data) ? data[0] : undefined;
    if (error || !result) {
        log.error('[motonui][rate-limit] check failed, request allowed', { bucket, error: error?.message ?? 'no result' });
        return;
    }
    if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((new Date(result.reset_at).getTime() - now.getTime()) / 1000));
        throw new RateLimitError(retryAfter);
    }
}
