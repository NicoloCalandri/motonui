import { z } from 'zod';
import { created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { createAdminClient } from '@/lib/supabase/server';
import { createUploadTarget, MAX_UPLOAD_BYTES, UPLOAD_EXTENSION_BY_MIME } from '@/lib/media/pipeline';

const UploadRequestSchema = z.object({
    mime_type: z.string().refine((mime) => mime in UPLOAD_EXTENSION_BY_MIME, 'tipo di file non supportato'),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'file troppo grande (max 50 MB)'),
});

/**
 * POST /api/trips/[id]/media/uploads — step 1 of the upload pipeline (T-2.2).
 * Returns a one-off signed upload to `trips/{id}/incoming/{uuid}.{ext}`; the
 * browser uploads straight to storage, then calls `…/media/confirm`.
 * Service role: members have no INSERT policy on the private bucket.
 */
export const POST = withRoute(
    { name: 'trips/[id]/media/uploads POST', params: tripParams(), body: UploadRequestSchema, tripMember: true, rateLimit: 'mediaUpload' },
    async ({ params, body }) => {
        const admin = await createAdminClient();
        const target = await createUploadTarget(admin, params.id, { mimeType: body.mime_type, size: body.size });
        return created(target);
    },
);
