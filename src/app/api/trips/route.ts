import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { ok, created } from '@/lib/errors';

const CreateTripSchema = z.object({
    title: z.string().min(1).max(200),
    destination: z.string().min(1).max(200),
    start_date: z.string().date().optional().or(z.literal('')),
    end_date: z.string().date().optional().or(z.literal('')),
    description: z.string().max(2000).optional(),
    cover_image: z.string().url().optional(),
});

/** GET /api/trips — list all trips for the authenticated user */
export const GET = withRoute({ name: 'trips GET' }, async ({ supabase, user }) => {
    const { data, error } = await supabase.from('trip_members')
        .select(`trip_id, trips (id, title, destination, cover_image, start_date, end_date, status, created_at)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[motonui][trips][GET] ${error.message}`);

    // Reshape to trip cards
    const trips = (data ?? [])
        .map((row) => row.trips)
        .filter((trip) => trip !== null);

    return ok(trips);
});

/**
 * POST /api/trips — create a new trip. create_trip() (migration 0021) inserts
 * the trip and the owner membership in one transaction with the user's JWT:
 * no service role, no trip left without its owner.
 */
export const POST = withRoute({ name: 'trips POST', body: CreateTripSchema }, async ({ supabase, body: input }) => {
    const { data: trip, error } = await supabase.rpc('create_trip', {
        p_title: input.title,
        p_destination: input.destination,
        // Optional RPC args: omitted when empty, the SQL defaults are null.
        p_start_date: input.start_date || undefined,
        p_end_date: input.end_date || undefined,
        p_description: input.description,
        p_cover_image: input.cover_image,
    });

    if (error || !trip) throw new Error(`[motonui][trips][POST] ${error?.message}`);

    return created(trip);
});