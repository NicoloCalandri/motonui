import { Hono } from 'hono';
import { z } from 'zod';
import { withErrorHandler, ok, created, requireParam, readJsonObject, issueSummary } from '../lib/http';
import { Errors } from '../lib/errors';
import { log } from '../lib/log';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips. Membership of /:id is checked by tripGuard (app.ts).
// Port of src/app/api/trips/route.ts and src/app/api/trips/[id]/route.ts.
export const tripsRouter = new Hono<AppEnv>();

const CreateTripSchema = z.object({
    title: z.string().min(1).max(200),
    destination: z.string().min(1).max(200),
    start_date: z.string().date().optional().or(z.literal('')),
    end_date: z.string().date().optional().or(z.literal('')),
    description: z.string().max(2000).optional(),
    cover_image: z.string().url().optional(),
});

const UpdateTripSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    destination: z.string().min(1).max(200).optional(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    cover_image: z.string().url().optional().nullable(),
    status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
    budget_eur: z.number().nonnegative().nullable().optional(),
});

/** GET /api/trips — list all trips for the authenticated user */
tripsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const { data, error } = await c.get('supabase')
            .from('trip_members')
            .select(`trip_id, trips (id, title, destination, cover_image, start_date, end_date, status, created_at)`)
            .eq('user_id', c.get('user').id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`[motonui][trips][GET] ${error.message}`);

        // Reshape to trip cards
        const trips = (data ?? [])
            .map((row) => row.trips)
            .filter((trip) => trip !== null);

        return ok(c, trips);
    }, 'trips GET')
);

/**
 * POST /api/trips — create a new trip. create_trip() (migration 0021) inserts
 * the trip and the owner membership in one transaction with the user's JWT:
 * no service role, no trip left without its owner.
 */
tripsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const parsed = CreateTripSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));
        const input = parsed.data;

        const { data: trip, error } = await c.get('supabase').rpc('create_trip', {
            p_title: input.title,
            p_destination: input.destination,
            // Optional RPC args: omitted when empty, the SQL defaults are null.
            p_start_date: input.start_date || undefined,
            p_end_date: input.end_date || undefined,
            p_description: input.description,
            p_cover_image: input.cover_image,
        });

        if (error || !trip) throw new Error(`[motonui][trips][POST] ${error?.message}`);

        return created(c, trip);
    }, 'trips POST')
);

/** GET /api/trips/:id — full trip with days, legs, accommodations */
tripsRouter.get(
    '/:id',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const { data: trip, error } = await c.get('supabase')
            .from('trips')
            .select(`
      *,
      trip_members (
        id, user_id, role
      ),
      days (
        *,
        legs (*),
        accommodations (*)
      ),
      restaurants (*),
      activities (*),
      documents (*),
      media (count),
      expenses (amount_eur, amount)
    `)
            .eq('id', requireParam(c, 'id'))
            .single();

        if (error) {
            // No row (PGRST116) or RLS: both answer 404; only the code is logged.
            log.warn('[motonui][trips/:id GET] trip lookup failed', { code: error.code });
            throw Errors.notFound('Viaggio');
        }

        return ok(c, trip);
    }, 'trips/:id GET')
);

/** PUT /api/trips/:id — update trip metadata */
tripsRouter.put(
    '/:id',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const id = requireParam(c, 'id');

        const parsed = UpdateTripSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

        const { data: trip, error } = await c.get('supabase')
            .from('trips')
            .update(parsed.data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw Errors.notFound('Viaggio');

        return ok(c, trip);
    }, 'trips/:id PUT')
);

/** DELETE /api/trips/:id — soft delete (status = 'archived') */
tripsRouter.delete(
    '/:id',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const { error } = await c.get('supabase')
            .from('trips')
            .update({ status: 'archived' })
            .eq('id', requireParam(c, 'id'))
            .eq('owner_id', c.get('user').id); // only owner can archive

        if (error) throw Errors.forbidden();

        return ok(c, { success: true });
    }, 'trips/:id DELETE')
);
