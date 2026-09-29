import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { createAdminClient } from '@/lib/supabase/server';
import { Buckets } from '@/lib/storage';
import { exportZipPath } from '@/lib/media/instagram-export';

/** A job still "processing" after this long died with its function. */
const STALE_AFTER_MS = 5 * 60 * 1000;
const MAX_LINK_SECONDS = 24 * 60 * 60;

interface ExportRow {
    id: string;
    trip_id: string;
    type: string;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    created_at: string;
    expires_at: string | null;
    zip_path: string | null;
    caption: string | null;
    hashtags: string[] | null;
    error: string | null;
}

/**
 * GET /api/trips/[id]/instagram/exports/[exportId] — job status, polled by the
 * generator. When ready, returns a signed download URL valid until the ZIP
 * expires (max 24 h); the bucket is private (migration 0023).
 */
export const GET = withRoute(
    { name: 'trips/[id]/instagram/exports/[exportId] GET', params: tripParams('exportId'), tripMember: true },
    async ({ supabase, params }) => {
        const { data } = await supabase
            .from('instagram_exports')
            .select('id, trip_id, type, status, created_at, expires_at, zip_path, caption, hashtags, error')
            .eq('id', params.exportId)
            .eq('trip_id', params.id)
            .maybeSingle();
        const job = data as ExportRow | null;
        if (!job) throw Errors.notFound('Export');

        const now = Date.now();
        let status = job.status;
        let error = job.error;
        if (status === 'processing' && now - Date.parse(job.created_at) > STALE_AFTER_MS) {
            status = 'failed';
            error = error ?? 'L’export si è interrotto. Riprova 🏝️';
        }

        const secondsLeft = job.expires_at ? Math.floor((Date.parse(job.expires_at) - now) / 1000) : 0;
        let downloadUrl: string | null = null;
        if (status === 'ready' && secondsLeft > 0 && job.zip_path === exportZipPath(params.id, job.id)) {
            const admin = await createAdminClient();
            const { data: signed } = await admin.storage
                .from(Buckets.instagramExports)
                .createSignedUrl(job.zip_path, Math.min(secondsLeft, MAX_LINK_SECONDS), { download: `motonui-${job.type}.zip` });
            downloadUrl = signed?.signedUrl ?? null;
        } else if (status === 'ready') {
            status = 'failed';
            error = 'Lo ZIP è scaduto: generane uno nuovo 🏝️';
        }

        return ok({
            id: job.id,
            status,
            error: status === 'failed' ? error : null,
            caption: job.caption,
            hashtags: job.hashtags ?? [],
            expires_at: job.expires_at,
            download_url: downloadUrl,
        });
    },
);
