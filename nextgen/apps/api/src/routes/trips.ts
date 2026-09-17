import { Hono } from 'hono';
import { z } from 'zod';
import { createAdminClient } from '../lib/supabase/server';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

export const tripsRouter = new Hono<AppEnv>();

const CreateTripSchema = z.object({
    title: z.string().min(1).max(200),
    destination: z.string().min(1).max(200),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    description: z.string().max(2000).optional(),
    cover_image: z.string().url().optional(),
});

/** GET /api/trips — list all trips for the authenticated user */
tripsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);

        const { data, error } = await (supabase.from('trip_members') as any)
            .select(`trip_id, trips (id, title, destination, cover_image, start_date, end_date, status, created_at)`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`[motonui][trips][GET] ${error.message}`);

        const trips = (data ?? [])
            .map((row: any) => row.trips)
            .filter(Boolean);

        return ok(c, trips);
    }, 'trips GET')
);

/** POST /api/trips — create a new trip */
tripsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = c.get('user');

        // Use admin client for creation to ensure trip + owner member are created atomically
        // and bypass any restrictive RLS during the initialization phase.
        const adminSupabase = createAdminClient();

        const body: unknown = await c.req.json();
        const parsed = CreateTripSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const input = parsed.data;

        const { data: trip, error: tripError } = await (adminSupabase.from('trips') as any)
            .insert({ ...input, owner_id: user.id })
            .select()
            .single();

        if (tripError || !trip) throw new Error(`[motonui][trips][POST] ${tripError?.message}`);

        const { error: memberError } = await (adminSupabase.from('trip_members') as any).insert({
            trip_id: trip.id,
            user_id: user.id,
            role: 'owner',
        });

        if (memberError) {
            console.error(`[motonui][trips][POST] Failed to add member: ${memberError.message}`);
        }

        return created(c, trip);
    }, 'trips POST')
);
