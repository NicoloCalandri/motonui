import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, passwordProblem, passwordSchema } from './password';

describe('password policy (SR-AUTH-07)', () => {
    it('requires at least 10 characters', () => {
        expect(PASSWORD_MIN_LENGTH).toBe(10);
        expect(passwordProblem('abc12345')).toMatch(/almeno 10 caratteri/);
    });

    it('requires a letter and a digit', () => {
        expect(passwordProblem('abcdefghijk')).toMatch(/lettera e un numero/);
        expect(passwordProblem('12345678901')).toMatch(/lettera e un numero/);
    });

    it('accepts a valid password', () => {
        expect(passwordProblem('isola-motu-nui-1')).toBeNull();
        expect(passwordSchema.safeParse('password123').success).toBe(true);
    });

    it('rejects passwords longer than bcrypt can hash', () => {
        expect(passwordSchema.safeParse(`a1${'x'.repeat(71)}`).success).toBe(false);
    });
});
