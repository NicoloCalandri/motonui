import { describe, it, expect, vi } from 'vitest';
import { AppError, Errors, withErrorHandler } from './errors';

vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number }) => ({
            body,
            status: init?.status ?? 200,
        }),
    },
}));

// =============================================================================
// AppError
// =============================================================================

describe('AppError', () => {
    it('sets message, code, and status', () => {
        const err = new AppError('Something went wrong', 'MY_CODE', 422);
        expect(err.message).toBe('Something went wrong');
        expect(err.code).toBe('MY_CODE');
        expect(err.status).toBe(422);
        expect(err.name).toBe('AppError');
    });

    it('defaults status to 500 when not provided', () => {
        const err = new AppError('Oops', 'OOPS');
        expect(err.status).toBe(500);
    });

    it('is an instance of Error', () => {
        const err = new AppError('msg', 'CODE', 400);
        expect(err).toBeInstanceOf(Error);
    });

    it('is an instance of AppError', () => {
        const err = new AppError('msg', 'CODE', 400);
        expect(err).toBeInstanceOf(AppError);
    });
});

// =============================================================================
// Errors factory
// =============================================================================

describe('Errors factory', () => {
    it('unauthorized returns status 401 and code UNAUTHORIZED', () => {
        const e = Errors.unauthorized();
        expect(e.status).toBe(401);
        expect(e.code).toBe('UNAUTHORIZED');
    });

    it('forbidden returns status 403 and code FORBIDDEN', () => {
        const e = Errors.forbidden();
        expect(e.status).toBe(403);
        expect(e.code).toBe('FORBIDDEN');
    });

    it('notFound returns status 404 and code NOT_FOUND', () => {
        const e = Errors.notFound();
        expect(e.status).toBe(404);
        expect(e.code).toBe('NOT_FOUND');
    });

    it('notFound uses default resource name when none provided', () => {
        const e = Errors.notFound();
        expect(e.message).toContain('Risorsa');
        expect(e.message).toContain('non trovata');
    });

    it('notFound includes custom resource name in message', () => {
        const e = Errors.notFound('Viaggio');
        expect(e.message).toContain('Viaggio');
        expect(e.message).toContain('non trovata');
    });

    it('validation returns status 400 and code VALIDATION_ERROR', () => {
        const e = Errors.validation('campo richiesto');
        expect(e.status).toBe(400);
        expect(e.code).toBe('VALIDATION_ERROR');
    });

    it('validation includes the detail string in the message', () => {
        const e = Errors.validation('email non valida');
        expect(e.message).toContain('email non valida');
    });

    it('internal returns status 500 and code INTERNAL_ERROR', () => {
        const e = Errors.internal();
        expect(e.status).toBe(500);
        expect(e.code).toBe('INTERNAL_ERROR');
    });

    it('rateLimited returns status 429 and code RATE_LIMITED', () => {
        const e = Errors.rateLimited();
        expect(e.status).toBe(429);
        expect(e.code).toBe('RATE_LIMITED');
    });

    it('each factory returns an AppError instance', () => {
        expect(Errors.unauthorized()).toBeInstanceOf(AppError);
        expect(Errors.forbidden()).toBeInstanceOf(AppError);
        expect(Errors.notFound()).toBeInstanceOf(AppError);
        expect(Errors.validation('x')).toBeInstanceOf(AppError);
        expect(Errors.internal()).toBeInstanceOf(AppError);
        expect(Errors.rateLimited()).toBeInstanceOf(AppError);
    });

    it('notFound with custom name does not contain default "Risorsa"', () => {
        const e = Errors.notFound('Spesa');
        expect(e.message).not.toContain('Risorsa');
        expect(e.message).toContain('Spesa');
    });
});

// =============================================================================
// withErrorHandler
// =============================================================================

describe('withErrorHandler', () => {
    const mockContext = { params: Promise.resolve({}) as Promise<Record<string, string>> };

    it('passes through the handler result when no error is thrown', async () => {
        const fakeResponse = { ok: true } as unknown as Response;
        const handler = vi.fn().mockResolvedValue(fakeResponse);
        const wrapped = withErrorHandler(handler, 'TEST GET');
        const result = await wrapped(new Request('http://localhost'), mockContext);
        expect(result).toBe(fakeResponse);
    });

    it('calls the original handler with the request and context', async () => {
        const handler = vi.fn().mockResolvedValue({} as Response);
        const wrapped = withErrorHandler(handler, 'TEST');
        const req = new Request('http://localhost/api/trips');
        await wrapped(req, mockContext);
        expect(handler).toHaveBeenCalledWith(req, mockContext);
    });

    it('returns 401 JSON response when Errors.unauthorized() is thrown', async () => {
        const handler = vi.fn().mockRejectedValue(Errors.unauthorized());
        const wrapped = withErrorHandler(handler, 'TEST POST');
        const result = (await wrapped(new Request('http://localhost'), mockContext)) as any;
        expect(result.status).toBe(401);
        expect(result.body.code).toBe('UNAUTHORIZED');
        expect(result.body.error).toBeDefined();
    });

    it('returns 404 JSON response when Errors.notFound() is thrown', async () => {
        const handler = vi.fn().mockRejectedValue(Errors.notFound('Trip'));
        const wrapped = withErrorHandler(handler, 'TRIPS GET');
        const result = (await wrapped(new Request('http://localhost'), mockContext)) as any;
        expect(result.status).toBe(404);
        expect(result.body.code).toBe('NOT_FOUND');
    });

    it('returns 500 InternalError response for unexpected errors', async () => {
        const handler = vi.fn().mockRejectedValue(new Error('Database exploded'));
        const wrapped = withErrorHandler(handler, 'TEST DELETE');
        const result = (await wrapped(new Request('http://localhost'), mockContext)) as any;
        expect(result.status).toBe(500);
        expect(result.body.code).toBe('INTERNAL_ERROR');
    });

    it('returns 400 JSON response when Errors.validation() is thrown', async () => {
        const handler = vi.fn().mockRejectedValue(Errors.validation('missing title'));
        const wrapped = withErrorHandler(handler, 'TRIPS POST');
        const result = (await wrapped(new Request('http://localhost'), mockContext)) as any;
        expect(result.status).toBe(400);
        expect(result.body.code).toBe('VALIDATION_ERROR');
    });
});
