import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam, readJsonObject, issueSummary } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireDayInTrip } from '../lib/authz';
import { createAdminClient } from '../lib/supabase/server';
import { createUploadTarget, ingestUpload, MAX_UPLOAD_BYTES, UPLOAD_EXTENSION_BY_MIME } from '../lib/media/pipeline';
import { removeMediaFiles, withSignedUrls } from '../lib/trip-storage';
import { sanitizePlainText } from '../lib/sanitize';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { Media } from '@motonui/shared-types';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/media. Membership is checked by tripGuard (app.ts).
// Port of src/app/api/trips/[id]/media/**: files live in the private bucket,
// are read through signed URLs and never travel in a request body.
export const tripsMediaRouter = new Hono<AppEnv>();

const FilterSchema = z.object({
    day_id: z.string().uuid().optional(),
});

const UploadRequestSchema = z.object({
    mime_type: z.string().refine((mime) => mime in UPLOAD_EXTENSION_BY_MIME, 'tipo di file non supportato'),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'file troppo grande (max 50 MB)'),
});

const ConfirmSchema = z.object({
    path: z.string().min(1).max(300),
    day_id: z.string().uuid().nullable().optional(),
    caption: z.string().max(500).nullable().optional(),
});

/** GET /api/trips/:id/media — media of a trip, optionally filtered by day, with signed URLs (1 h) */
tripsMediaRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');

        const filter = FilterSchema.safeParse({ day_id: c.req.query('day_id') });
        if (!filter.success) throw Errors.validation(issueSummary(filter.error));

        let query = supabase
            .from('media')
            .select('*')
            .eq('trip_id', id)
            .order('taken_at', { ascending: true })
            .order('created_at', { ascending: false });

        if (filter.data.day_id) query = query.eq('day_id', filter.data.day_id);

        const { data, error } = await query;
        if (error) throw new Error(`[motonui][media][GET] ${error.message}`);

        return ok(c, await withSignedUrls(supabase, id, (data ?? []) as Media[]));
    }, 'trips/:id/media GET')
);

/**
 * POST /api/trips/:id/media/uploads — step 1 of the upload pipeline.
 * Returns a one-off signed upload to `trips/{id}/incoming/{uuid}.{ext}`; the
 * browser uploads straight to storage, then calls `…/media/confirm`.
 * Service role: members have no INSERT policy on the private bucket.
 */
tripsMediaRouter.post(
    '/uploads',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const id = requireParam(c, 'id');

        const parsed = UploadRequestSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

        const target = await createUploadTarget(createAdminClient(), id, { mimeType: parsed.data.mime_type, size: parsed.data.size });
        return created(c, target);
    }, 'trips/:id/media/uploads POST')
);

/**
 * POST /api/trips/:id/media/confirm — step 2 of the upload pipeline.
 * Checks the uploaded bytes, strips metadata (sharp re-encode), writes the
 * original and the 400×400 WebP thumbnail, then creates the media row.
 */
tripsMediaRouter.post(
    '/confirm',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const parsed = ConfirmSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));
        const body = parsed.data;

        await requireDayInTrip(supabase, id, body.day_id);

        const ingested = await ingestUpload(createAdminClient(), id, body.path);

        const { data: media, error } = await supabase
            .from('media')
            .insert({
                trip_id: id,
                day_id: body.day_id ?? null,
                uploaded_by: user.id,
                storage_path: ingested.storage_path,
                thumb_path: ingested.thumb_path,
                mime_type: ingested.mime_type,
                size: ingested.size,
                width: ingested.width,
                height: ingested.height,
                taken_at: ingested.metadata.dateTaken ?? null,
                gps_lat: ingested.metadata.gps?.lat ?? null,
                gps_lng: ingested.metadata.gps?.lng ?? null,
                camera: ingested.metadata.camera ?? null,
                caption: body.caption ? sanitizePlainText(body.caption, 500) : null,
                tags: [],
            })
            .select()
            .single();

        if (error || !media) {
            await removeMediaFiles(id, ingested);
            throw new Error(`[motonui][media][confirm] ${error?.message ?? 'insert failed'}`);
        }

        const [withUrls] = await withSignedUrls(supabase, id, [media as Media]);
        return created(c, withUrls);
    }, 'trips/:id/media/confirm POST')
);

/** DELETE /api/trips/:id/media/:mediaId — delete a media item and its stored files */
tripsMediaRouter.delete(
    '/:mediaId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');
        const mediaId = requireParam(c, 'mediaId');

        const { data: media, error } = await supabase
            .from('media')
            .delete()
            .eq('id', mediaId)
            .eq('trip_id', id)
            .select('storage_path, thumb_path')
            .maybeSingle();

        if (error || !media) throw Errors.notFound('Media');

        // Paths come from the row but are re-checked against the trip prefix
        // before the service role touches storage.
        await removeMediaFiles(id, media);

        return ok(c, { success: true });
    }, 'trips/:id/media/:mediaId DELETE')
);
