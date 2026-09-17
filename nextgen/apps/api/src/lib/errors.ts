/**
 * Standard API error structure returned to clients.
 */
export interface ApiErrorResponse {
    error: string;
    code: string;
    status: number;
}

/**
 * Application error class with a client-safe message, error code, and HTTP status.
 */
export class AppError extends Error {
    public readonly code: string;
    public readonly status: number;

    constructor(message: string, code: string, status: number = 500) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
    }
}

/** Common pre-defined errors */
export const Errors = {
    unauthorized: () =>
        new AppError('Non sei autenticato. Effettua il login per continuare.', 'UNAUTHORIZED', 401),
    forbidden: () =>
        new AppError("Non hai i permessi per accedere a questa risorsa.", 'FORBIDDEN', 403),
    notFound: (resource = 'Risorsa') =>
        new AppError(`${resource} non trovata.`, 'NOT_FOUND', 404),
    validation: (detail: string) =>
        new AppError(`Dati non validi: ${detail}`, 'VALIDATION_ERROR', 400),
    internal: () =>
        new AppError('Ops! Qualcosa è andato storto 🏝️', 'INTERNAL_ERROR', 500),
    rateLimited: () =>
        new AppError('Hai raggiunto il limite di utilizzo AI per oggi.', 'RATE_LIMITED', 429),
};
