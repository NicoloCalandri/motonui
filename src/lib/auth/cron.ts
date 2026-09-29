import { createHash, timingSafeEqual } from 'node:crypto';

/** Vercel requires at least 16 characters; we ask for 32 like the other secrets. */
const MIN_SECRET_LENGTH = 32;

function digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

/**
 * True if the request carries `Authorization: Bearer ${CRON_SECRET}` (T-2.6,
 * SR-INT-06). Vercel Cron sends this header on its GET calls. Comparison is
 * constant-time over fixed-length digests; a missing or short secret fails
 * closed. Never log the header.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
        console.error('[motonui][cron] CRON_SECRET is missing or shorter than 32 characters');
        return false;
    }

    const header = request.headers.get('authorization') ?? '';
    return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
