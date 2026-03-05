import { NextResponse } from 'next/server';

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

type RouteHandler = (
    request: Request,
    context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

/**
 * Higher-order function that wraps a route handler with try/catch error handling.
 * Logs errors with structured format and returns consistent JSON error responses.
 *
 * @param handler - The async route handler to wrap
 * @param routeInfo - String describing the route for logging (e.g., "trips GET")
 */
export function withErrorHandler(handler: RouteHandler, routeInfo: string): RouteHandler {
    return async (request, context) => {
        try {
            return await handler(request, context);
        } catch (error) {
            if (error instanceof AppError) {
                console.error(`[motonui][${routeInfo}] AppError:`, {
                    code: error.code,
                    status: error.status,
                    message: error.message,
                });
                return NextResponse.json(
                    { error: error.message, code: error.code, status: error.status } satisfies ApiErrorResponse,
                    { status: error.status }
                );
            }

            // Unexpected errors
            console.error(`[motonui][${routeInfo}] Unexpected error:`, error);
            const internal = Errors.internal();
            return NextResponse.json(
                { error: internal.message, code: internal.code, status: internal.status } satisfies ApiErrorResponse,
                { status: 500 }
            );
        }
    };
}

/**
 * Returns a 200 OK JSON response.
 */
export function ok<T>(data: T, status: number = 200): Response {
    return NextResponse.json(data, { status });
}

/**
 * Returns a 201 Created JSON response.
 */
export function created<T>(data: T): Response {
    return NextResponse.json(data, { status: 201 });
}
