import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';

const CreateTripSchema = z.object({
    title: z.string().min(1).max(200),
    destination: z.string().min(1).max(200),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    description: z.string().max(2000).optional(),
    cover_image: z.string().url().optional(),
});

/** GET /api/trips — list all trips for the authenticated user */
export const GET = withErrorHandler(async () => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { data, error } = await supabase.from('trip_members')
        .select(`trip_id, trips (id, title, destination, cover_image, start_date, end_date, status, created_at)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    // stampa a console per debug
    console.log('Fetched trips for user', user.id, { data, error });

    if (error) throw new Error(`[motonui][trips][GET] ${error.message}`);

    // Reshape to trip cards
    const trips = (data ?? [])
        .map((row) => row.trips)
        .filter(Boolean);

    return ok(trips);
}, 'trips GET');

/** POST /api/trips — create a new trip */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    // Use admin client for creation to ensure trip + owner member are created atomically 
    // and bypass any restrictive RLS during the initialization phase.
    const adminSupabase = await createAdminClient();

    const body: unknown = await request.json();
    const parsed = CreateTripSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const input = parsed.data;

    // Create trip
    const { data: trip, error: tripError } = await adminSupabase.from('trips')
        .insert({ ...input, owner_id: user.id })
        .select()
        .single();

    if (tripError || !trip) throw new Error(`[motonui][trips][POST] ${tripError?.message}`);

    // Auto-add creator as owner member
    const { error: memberError } = await adminSupabase.from('trip_members').insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'owner',
    });

    if (memberError) {
        console.error(`[motonui][trips][POST] Failed to add member: ${memberError.message}`);
    }

    return created(trip);
}, 'trips POST');