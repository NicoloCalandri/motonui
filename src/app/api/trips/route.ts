import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';
import { formatZodError } from '@/lib/validation';

const CreateTripSchema = z.object({
    title: z.string().min(1).max(200),
    destination: z.string().min(1).max(200),
    start_date: z.string().date().optional().or(z.literal('')),
    end_date: z.string().date().optional().or(z.literal('')),
    description: z.string().max(2000).optional(),
    cover_image: z.string().url().optional(),
});

/** GET /api/trips — list all trips for the authenticated user */
export const GET = withErrorHandler(async () => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { data, error } = await (supabase.from('trip_members') as any)
        .select(`trip_id, trips (id, title, destination, cover_image, start_date, end_date, status, created_at)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[motonui][trips][GET] ${error.message}`);

    // Reshape to trip cards
    const trips = (data ?? [])
        .map((row: any) => row.trips)
        .filter(Boolean);

    return ok(trips);
}, 'trips GET');

/**
 * POST /api/trips — create a new trip. create_trip() (migration 0021) inserts
 * the trip and the owner membership in one transaction with the user's JWT:
 * no service role, no trip left without its owner.
 */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    await getAuthUser(supabase);

    const body: unknown = await request.json();
    const parsed = CreateTripSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(formatZodError(parsed.error));

    const input = parsed.data;
    const { data: trip, error } = await supabase.rpc('create_trip', {
        p_title: input.title,
        p_destination: input.destination,
        p_start_date: input.start_date || null,
        p_end_date: input.end_date || null,
        p_description: input.description ?? null,
        p_cover_image: input.cover_image ?? null,
    });

    if (error || !trip) throw new Error(`[motonui][trips][POST] ${error?.message}`);

    return created(trip);
}, 'trips POST');