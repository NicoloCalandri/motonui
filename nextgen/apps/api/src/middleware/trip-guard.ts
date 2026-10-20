import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { requireUser } from './auth';
import type { AppEnv } from '../types';

const tripId = z.string().uuid();

const validTripId = createMiddleware<AppEnv>(async (c, next) => {
    if (!tripId.safeParse(c.req.param('id')).success) {
        throw Errors.validation('identificativo del viaggio non valido');
    }
    await next();
});

const tripMembership = createMiddleware<AppEnv>(async (c, next) => {
    await requireTripMember(c.get('supabase'), c.req.param('id') as string, c.get('user').id);
    await next();
});

/**
 * Guards every route under /api/trips/:id, in this order: the id must be a
 * UUID (400, before any query), the caller must be signed in (401) and must
 * belong to the trip (403). It is the Hono counterpart of `tripMember: true`
 * in the Next.js withRoute (src/lib/api/with-route.ts), applied once in
 * app.ts instead of once per handler, so a route cannot forget it. RLS stays
 * the primary boundary; this is the second one.
 */
export const tripGuard = [validTripId, requireUser, tripMembership] as const;
