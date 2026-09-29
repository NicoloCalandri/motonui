import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '@/lib/errors';

/**
 * Partner invites (T-2.5, SR-AUTHZ-09, FR-02). The token travels only in the
 * email link; the database stores its SHA-256 (migration 0021), and
 * accept_trip_invite() hashes the token it receives the same way.
 */

export const INVITE_TOKEN_BYTES = 32;

/** 256 random bits, base64url (43 characters, safe in a URL path). */
export function generateInviteToken(): string {
    return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

export function hashInviteToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function inviteUrl(token: string, appUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
    const base = (appUrl ?? 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/invite/${token}`;
}

/** Maps the RPC exceptions of migration 0021 to user-facing errors. */
export function inviteErrorToAppError(message: string | undefined): AppError | null {
    if (!message) return null;
    if (message.startsWith('TRIP_FULL')) {
        return new AppError('Questo viaggio ha già due viaggiatori 🏝️', 'TRIP_FULL', 409);
    }
    if (message.startsWith('INVITE_INVALID')) {
        return new AppError('Questo invito non è valido o è scaduto. Chiedi un nuovo link 🏝️', 'INVITE_INVALID', 404);
    }
    if (message.startsWith('INVITE_EMAIL_MISMATCH')) {
        return new AppError(
            "Questo invito è per un altro indirizzo email: accedi con l'account a cui è stato inviato.",
            'INVITE_EMAIL_MISMATCH',
            403,
        );
    }
    if (message.startsWith('FORBIDDEN')) {
        return new AppError('Solo chi ha creato il viaggio può invitare il partner.', 'FORBIDDEN', 403);
    }
    return null;
}
