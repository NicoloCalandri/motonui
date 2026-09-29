// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { generateInviteToken, hashInviteToken, INVITE_TOKEN_PATTERN, inviteErrorToAppError, inviteUrl } from './invites';

describe('invite tokens', () => {
    it('are 256-bit, URL-safe and unique', () => {
        const tokens = new Set(Array.from({ length: 50 }, generateInviteToken));
        expect(tokens.size).toBe(50);
        for (const token of tokens) expect(token).toMatch(INVITE_TOKEN_PATTERN);
    });

    it('hash like accept_trip_invite() in SQL: encode(sha256(convert_to(token, \'UTF8\')), \'hex\')', () => {
        // FIPS 180-2 vector; Postgres returns the same for sha256(convert_to('abc', 'UTF8')).
        expect(hashInviteToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        // A generated token hashes to 64 hex chars, the only form the DB accepts.
        expect(hashInviteToken(generateInviteToken())).toMatch(/^[0-9a-f]{64}$/);
    });

    it('build the link from the app URL', () => {
        expect(inviteUrl('t0k', 'https://motonui.app/')).toBe('https://motonui.app/invite/t0k');
    });
});

describe('inviteErrorToAppError', () => {
    it.each([
        ['TRIP_FULL: a trip has at most two members', 409, 'TRIP_FULL'],
        ['INVITE_INVALID: invite not found, used or expired', 404, 'INVITE_INVALID'],
        ['INVITE_EMAIL_MISMATCH: invite sent to another address', 403, 'INVITE_EMAIL_MISMATCH'],
        ['FORBIDDEN: only the trip owner can invite', 403, 'FORBIDDEN'],
    ])('maps %s', (message, status, code) => {
        const error = inviteErrorToAppError(message);
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ status, code });
    });

    it('leaves unknown database errors to the generic handler', () => {
        expect(inviteErrorToAppError('connection reset')).toBeNull();
        expect(inviteErrorToAppError(undefined)).toBeNull();
    });
});
