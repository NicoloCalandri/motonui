import { z } from 'zod';
import { created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { requireDayInTrip } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/server';
import { ingestUpload } from '@/lib/media/pipeline';
import { removeMediaFiles, withSignedUrls } from '@/lib/trip-storage';
import { sanitizePlainText } from '@/lib/sanitize';
import type { Media } from '@/lib/types';

const ConfirmSchema = z.object({
    path: z.string().min(1).max(300),
    day_id: z.string().uuid().nullable().optional(),
    caption: z.string().max(500).nullable().optional(),
});

/**
 * POST /api/trips/[id]/media/confirm — step 2 of the upload pipeline (T-2.2).
 * Checks the uploaded bytes, strips metadata (sharp re-encode), writes the
 * original and the 400×400 WebP thumbnail, then creates the media row.
 */
export const POST = withRoute(
    { name: 'trips/[id]/media/confirm POST', params: tripParams(), body: ConfirmSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
        await requireDayInTrip(supabase, params.id, body.day_id);

        const admin = await createAdminClient();
        const ingested = await ingestUpload(admin, params.id, body.path);

        const { data: media, error } = await supabase
            .from('media')
            .insert({
                trip_id: params.id,
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
            await removeMediaFiles(params.id, ingested);
            throw new Error(`[motonui][media][confirm] ${error?.message ?? 'insert failed'}`);
        }

        const [withUrls] = await withSignedUrls(supabase, params.id, [media as Media]);
        return created(withUrls);
    },
);
