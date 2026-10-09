/**
 * User-facing error messages for the mobile app (see docs/brand-voice.md).
 * Alerts use the title "Ops!", so these messages do not repeat it.
 */

export const GENERIC_ERROR = 'Qualcosa è andato storto. Riprova tra poco 🏝️';
export const SAVE_ERROR = 'Non riusciamo a salvare. Riprova tra poco 🏝️';
export const DELETE_ERROR = 'Non riusciamo a eliminare. Riprova tra poco 🏝️';
const NETWORK_ERROR = 'Sembra che manchi la connessione. Riprova quando torni online 🏝️';

const AUTH_MESSAGES: Record<string, string> = {
  otp_expired: 'Il codice è scaduto o non è valido. Richiedine uno nuovo 🏝️',
  invalid_credentials: 'Email o codice non corrispondono. Riprova 🏝️',
  over_request_rate_limit: 'Troppi tentativi di fila. Aspetta qualche minuto e riprova 🏝️',
  over_email_send_rate_limit: 'Ti abbiamo già scritto da poco. Controlla la posta e riprova tra qualche minuto 🏝️',
  email_address_invalid: 'Controlla l’indirizzo email: sembra che manchi qualcosa 🏝️',
  validation_failed: 'Controlla l’indirizzo email: sembra che manchi qualcosa 🏝️',
  email_exists: 'Questa email è già usata da un altro account 🏝️',
  user_banned: 'Il tuo account è in pausa. Scrivici se pensi che sia un errore.',
  session_expired: 'La sessione è scaduta. Accedi di nuovo 🏝️',
};

function field(error: object, key: string): unknown {
  return (error as Record<string, unknown>)[key];
}

/** Italian message for any thrown value; a provider's own wording is never returned. */
export function friendlyError(error: unknown, fallback: string = GENERIC_ERROR): string {
  if (!(error instanceof Error)) return fallback;

  if (field(error, '__isAuthError') === true) {
    const code = field(error, 'code');
    return (typeof code === 'string' && AUTH_MESSAGES[code]) || fallback;
  }
  if (error instanceof TypeError && /network request failed|failed to fetch/i.test(error.message)) {
    return NETWORK_ERROR;
  }
  // A plain Error is one the app threw itself, with an Italian message.
  if (error.name === 'Error' && !('code' in error) && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
