import { z } from 'zod';
import { Errors, ok, created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { requireDayInTrip } from '@/lib/authz';
import { Buckets, uploadPrivateFile, validateFile } from '@/lib/storage';
import { buildMediaPath } from '@/lib/trip-files';
import { removeMediaFiles, withSignedUrls } from '@/lib/trip-storage';
import { sanitizePlainText } from '@/lib/sanitize';
import type { Media } from '@/lib/types';

const FilterSchema = z.object({
    day_id: z.string().uuid().optional(),
});

const EXTENSION_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
};

/**
 * GET /api/trips/[id]/media — media of a trip, optionally filtered by day,
 * with signed URLs (1 h) for files in the private bucket (T-2.1).
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

/** POST /api/trips/[id]/media — upload a photo/video to the private bucket */
export const POST = withRoute(
    { name: 'trips/[id]/media POST', params: tripParams(), tripMember: true },
    async ({ request, supabase, user, params }) => {
        const formData = await request.formData();
        const file = formData.get('file');
        const dayId = formData.get('day_id');
        const caption = formData.get('caption');

        if (!(file instanceof File)) throw Errors.validation('Campo "file" mancante.');
        if (dayId !== null && (typeof dayId !== 'string' || !z.string().uuid().safeParse(dayId).success)) {
            throw Errors.validation('day_id non valido.');
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        validateFile(file.type, file.size, buffer);
        await requireDayInTrip(supabase, params.id, dayId);

        const extension = EXTENSION_BY_MIME[file.type];
        if (!extension) throw Errors.validation('Tipo di file non supportato per le foto del viaggio.');

        // Server-built, non-guessable path inside the trip folder.
        const storagePath = buildMediaPath(params.id, 'original', extension);
        await uploadPrivateFile(Buckets.tripMedia, storagePath, buffer, file.type);

        const { data: media, error } = await supabase
            .from('media')
            .insert({
                trip_id: params.id,
                day_id: dayId ?? null,
                uploaded_by: user.id,
                storage_path: storagePath,
                size: file.size,
                mime_type: file.type,
                caption: typeof caption === 'string' && caption ? sanitizePlainText(caption, 500) : null,
                tags: [],
            })
            .select()
            .single();

        if (error || !media) {
            await removeMediaFiles(params.id, { storage_path: storagePath, thumb_path: null });
            throw new Error(`[motonui][media][POST] ${error?.message ?? 'insert failed'}`);
        }

        const [withUrls] = await withSignedUrls(supabase, params.id, [media as Media]);
        return created(withUrls);
    },
);

