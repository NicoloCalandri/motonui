import { describe, expect, it } from 'vitest';
import { DELETE_ERROR, GENERIC_ERROR, SAVE_ERROR, friendlyError } from './errors';

function authError(code: string | undefined, message: string) {
    return Object.assign(new Error(message), { name: 'AuthApiError', __isAuthError: true, code, status: 400 });
}

describe('friendlyError', () => {
    it('keeps a validation message written by the app', () => {
        expect(friendlyError(new Error('Inserisci il nome del viaggio.'))).toBe('Inserisci il nome del viaggio.');
    });

    it('maps a Supabase Auth code to Italian', () => {
        expect(friendlyError(authError('otp_expired', 'Token has expired or is invalid')))
            .toBe('Il codice è scaduto o non è valido. Richiedine uno nuovo 🏝️');
        expect(friendlyError(authError('over_email_send_rate_limit', 'Email rate limit exceeded')))
            .toContain('Ti abbiamo già scritto da poco');
    });

    it('never shows an unknown Auth message', () => {
        expect(friendlyError(authError('unexpected_failure', 'Database error'), SAVE_ERROR)).toBe(SAVE_ERROR);
        expect(friendlyError(authError(undefined, 'Database error'), SAVE_ERROR)).toBe(SAVE_ERROR);
    });

    it('never shows a database error', () => {
        const pg = Object.assign(new Error('new row violates row-level security policy'), { name: 'PostgrestError', code: '42501', details: null, hint: null });
        expect(friendlyError(pg, DELETE_ERROR)).toBe(DELETE_ERROR);
    });

    it('recognises a dropped connection', () => {
        expect(friendlyError(new TypeError('Network request failed'))).toContain('connessione');
    });

    it.each([null, undefined, 'boom', 42, {}, new Error('')])('falls back for %p', (value) => {
        expect(friendlyError(value)).toBe(GENERIC_ERROR);
    });

    it('messages do not repeat the alert title', () => {
        for (const message of [SAVE_ERROR, DELETE_ERROR, GENERIC_ERROR]) {
            expect(message.startsWith('Ops')).toBe(false);
            expect(message.endsWith('🏝️')).toBe(true);
        }
    });
});
