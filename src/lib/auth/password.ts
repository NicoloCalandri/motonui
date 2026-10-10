import { z } from 'zod';

/**
 * Password policy (SR-AUTH-07, T-4.8). Mirrors supabase/config.toml
 * (minimum_password_length, password_requirements = "letters_digits") and the
 * cloud project settings: Supabase Auth enforces it, these checks only give
 * the user a clear message before the request.
 */
export const PASSWORD_MIN_LENGTH = 10;

/** Italian message describing what the password lacks, or null when it is valid. */
export function passwordProblem(password: string): string | null {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri 🏝️`;
    }
    if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
        return 'La password deve contenere almeno una lettera e un numero 🏝️';
    }
    return null;
}

export const passwordSchema = z.string().max(72).superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});
