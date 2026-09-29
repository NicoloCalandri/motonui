import { z } from 'zod';
import { ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { withSignedUrls } from '@/lib/trip-storage';
import type { Media } from '@/lib/types';

const FilterSchema = z.object({
    day_id: z.string().uuid().optional(),
});

/**
 * GET /api/trips/[id]/media — media of a trip, optionally filtered by day,
 * with signed URLs (1 h) for files in the private bucket (T-2.1).
 *
 * Uploads go through `…/media/uploads` + `…/media/confirm` (T-2.2): the file
 * never passes through this route, whose body is capped at ~4.5 MB on Vercel.
 */
export const GET = withRoute(
    { name: 'trips/[id]/media GET', params: tripParams(), query: FilterSchema, tripMember: true },
    async ({ supabase, params, query }) => {
        let request = supabase
            .from('media')
            .select('*')
            .eq('trip_id', params.id)
            .order('taken_at', { ascending: true })
            .order('created_at', { ascending: false });

        if (query.day_id) request = request.eq('day_id', query.day_id);

        const { data, error } = await request;
        if (error) throw new Error(`[motonui][media][GET] ${error.message}`);

        return ok(await withSignedUrls(supabase, params.id, (data ?? []) as Media[]));
    },
);
