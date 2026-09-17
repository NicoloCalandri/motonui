import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember, requireDayInTrip } from '../lib/authz';
import { uploadFile, validateFile, Buckets } from '../lib/storage';
import { sanitizePlainText } from '../lib/sanitize';
import { env } from '../lib/env';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/media
export const tripsMediaRouter = new Hono<AppEnv>();

const FilterSchema = z.object({
    day_id: z.string().uuid().optional(),
});

/** GET /api/trips/:id/media — list all media for a trip, optionally filtered by day */
tripsMediaRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const url = new URL(c.req.url);
        const filter = FilterSchema.safeParse({
            day_id: url.searchParams.get('day_id') ?? undefined,
        });

        let query = supabase
            .from('media')
            .select('*')
            .eq('trip_id', id)
            .order('taken_at', { ascending: true })
            .order('created_at', { ascending: false });

        if (filter.success && filter.data.day_id) {
            query = query.eq('day_id', filter.data.day_id);
        }

        const { data, error } = await query;
        if (error) throw new Error(`[motonui][media][GET] ${error.message}`);

        return ok(c, data ?? []);
    }, 'trips/:id/media GET')
);

/** POST /api/trips/:id/media — upload photo/video to Supabase Storage */
tripsMediaRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const formData = await c.req.formData();
        const file = formData.get('file') as File | null;
        const dayId = formData.get('day_id') as string | null;
        const caption = formData.get('caption') as string | null;

        if (!file) throw Errors.validation('Campo "file" mancante.');

        const buffer = Buffer.from(await file.arrayBuffer());
        validateFile(file.type, file.size, buffer);
        await requireDayInTrip(supabase, id, dayId);

        const fileExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
        const filename = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `trips/${id}/original/${filename}`;

        const publicUrl = await uploadFile(Buckets.tripMedia, storagePath, buffer, file.type);

        const { data: media, error } = await supabase
            .from('media')
            .insert({
                trip_id: id,
                day_id: dayId ?? null,
                uploaded_by: user.id,
                url: publicUrl,
                size: file.size,
                mime_type: file.type,
                caption: caption ? sanitizePlainText(caption, 500) : null,
                tags: [],
            })
            .select()
            .single();

        if (error) throw new Error(`[motonui][media][POST] ${error.message}`);

        return created(c, media);
    }, 'trips/:id/media POST')
);

/** DELETE /api/trips/:id/media/:mediaId — delete a media item and its storage object */
tripsMediaRouter.delete(
    '/:mediaId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const mediaId = requireParam(c, 'mediaId');

        const { data: media, error: fetchError } = await supabase
            .from('media')
            .select('url, trip_id')
            .eq('id', mediaId)
            .eq('trip_id', id)
            .single();

        if (fetchError || !media) throw Errors.notFound('Media');

        try {
            const prefix = `${env.SUPABASE_URL}/storage/v1/object/public/${Buckets.tripMedia}/`;
            if (media.url.startsWith(prefix)) {
                const storagePath = media.url.slice(prefix.length);
                await supabase.storage.from(Buckets.tripMedia).remove([storagePath]);
            }
        } catch {
            // Non-fatal: proceed to delete the DB record even if storage removal fails
        }

        const { error } = await supabase
            .from('media')
            .delete()
            .eq('id', mediaId)
            .eq('trip_id', id);

        if (error) throw Errors.notFound('Media');

        return ok(c, { success: true });
    }, 'trips/:id/media/:mediaId DELETE')
);
