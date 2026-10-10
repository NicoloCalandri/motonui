import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-error-message';

describe('authErrorMessage', () => {
    it('maps a known error code to an Italian message', () => {
        expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
            .toBe('Ops! Email o password non corrispondono. Riprova 🏝️');
    });

    it('recognises the English message when the code is missing', () => {
        expect(authErrorMessage({ message: 'Invalid login credentials' })).toContain('Email o password non corrispondono');
        expect(authErrorMessage({ message: 'Email not confirmed' })).toContain('conferma il tuo indirizzo');
        expect(authErrorMessage({ message: 'Email rate limit exceeded' })).toContain('Troppi tentativi');
    });

    it('treats a 429 without code as a rate limit', () => {
        expect(authErrorMessage({ message: 'Slow down', status: 429 })).toContain('Troppi tentativi');
    });

    it('never returns the provider message for an unknown error', () => {
        const message = authErrorMessage({ code: 'unexpected_failure', message: 'Database error querying schema' });
        expect(message).toBe('Ops! Qualcosa è andato storto. Riprova tra poco 🏝️');
    });

    it('falls back when there is no error object', () => {
        expect(authErrorMessage(null)).toContain('Qualcosa è andato storto');
        expect(authErrorMessage(undefined)).toContain('Qualcosa è andato storto');
    });
});
