/**
 * Italian, on-brand messages for Supabase Auth errors.
 *
 * Supabase returns English messages ("Invalid login credentials"): they are
 * never shown to the user as they are. Unknown errors fall back to a generic
 * message instead of leaking the provider's wording.
 */

type AuthErrorLike = {
    message?: string;
    code?: string;
    status?: number;
};

const FALLBACK = 'Ops! Qualcosa è andato storto. Riprova tra poco 🏝️';

const MESSAGES_BY_CODE: Record<string, string> = {
    invalid_credentials: 'Ops! Email o password non corrispondono. Riprova 🏝️',
    email_not_confirmed: 'Manca un passo: conferma il tuo indirizzo dal link che ti abbiamo inviato via email 🏝️',
    user_banned: 'Il tuo account è in pausa. Scrivici se pensi che sia un errore.',
    over_request_rate_limit: 'Troppi tentativi di fila. Aspetta qualche minuto e riprova 🏝️',
    over_email_send_rate_limit: 'Ti abbiamo già scritto da poco. Controlla la posta e riprova tra qualche minuto 🏝️',
    weak_password: 'Questa password è troppo semplice. Scegline una più robusta 🏝️',
    same_password: 'La nuova password deve essere diversa da quella attuale 🏝️',
    validation_failed: 'Controlla l’indirizzo email: sembra che manchi qualcosa 🏝️',
};

/** Older GoTrue versions send no `code`: the English message is the only signal. */
const CODE_BY_MESSAGE: [RegExp, string][] = [
    [/invalid login credentials/i, 'invalid_credentials'],
    [/email not confirmed/i, 'email_not_confirmed'],
    [/rate limit|too many requests/i, 'over_request_rate_limit'],
];

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
    if (!error) return FALLBACK;

    const code = error.code ?? CODE_BY_MESSAGE.find(([pattern]) => pattern.test(error.message ?? ''))?.[1];
    if (code && MESSAGES_BY_CODE[code]) return MESSAGES_BY_CODE[code];
    if (error.status === 429) return MESSAGES_BY_CODE.over_request_rate_limit;

    return FALLBACK;
}
