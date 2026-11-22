import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { Errors, withErrorHandler } from '@/lib/errors';
import { guid } from '@/lib/ids';

/** Raw route params as Next.js passes them. */
type AdminParams = Record<string, string>;

export interface AdminRouteContext<P extends AdminParams> {
    request: Request;
    /** The calling admin's user id. */
    adminId: string;
    /** Route params; every `id`/`…Id` param is a validated UUID. */
    params: P;
}

/** A route handler built by withAdminRoute, carrying its log label. */
export type AdminRouteHandler<P extends AdminParams> = ((request: Request, context: { params: Promise<P> }) => Promise<Response>) & {
    adminRoute: { name: string };
};

const uuid = guid();

/** Params named `id` or ending in `Id` are row ids: anything but a UUID is a 400, before any query. */
function assertIdParams(params: AdminParams): void {
    for (const [key, value] of Object.entries(params)) {
        if ((key === 'id' || key.endsWith('Id')) && !uuid.safeParse(value).success) {
            throw Errors.validation(`${key}: identificativo non valido`);
        }
    }
}

/** Reads a JSON body; a malformed one is a 400 instead of an unhandled SyntaxError. */
export async function readJsonBody(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        throw Errors.validation('corpo della richiesta non valido (JSON atteso)');
    }
}

/**
 * Entry point for the /api/admin/* routes called by the admin UI (audit A4):
 * the counterpart of withRoute for routes that run with the service role.
 *
 * - `requireAdmin()` before anything else (401/403 in the standard format);
 * - id params validated as UUIDs;
 * - unexpected errors go through withErrorHandler: generic message to the
 *   client, structured log and Sentry with the request id, never a stack or a
 *   database message in the response;
 * - `Cache-Control: private, no-store`: admin data never sits in a cache.
 *
 * Cron routes (cleanup, send-reminders) authenticate with CRON_SECRET and keep
 * withErrorHandler + isAuthorizedCronRequest.
 */
export function withAdminRoute<P extends AdminParams = AdminParams>(
    name: string,
    handler: (ctx: AdminRouteContext<P>) => Promise<Response>,
): AdminRouteHandler<P> {
    const wrapped = withErrorHandler(async (request, context) => {
        const admin = await requireAdmin();
        if (admin instanceof NextResponse) return admin;

        const params = ((await context.params) ?? {}) as P;
        assertIdParams(params);

        const response = await handler({ request, adminId: admin.adminId, params });
        try {
            if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'private, no-store');
        } catch {
            // Immutable headers (e.g. Response.redirect): leave as is.
        }
        return response;
    }, name);

    const typed = wrapped as unknown as (request: Request, context: { params: Promise<P> }) => Promise<Response>;
    return Object.assign(typed, { adminRoute: { name } });
}
