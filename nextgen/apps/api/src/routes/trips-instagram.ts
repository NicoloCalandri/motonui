import { Hono } from 'hono';
import { z } from 'zod';
import { withErrorHandler, ok, requireParam, readJsonObject, issueSummary } from '../lib/http';
import { AppError, Errors } from '../lib/errors';
import { runInBackground } from '../lib/background';
import { log } from '../lib/log';
import { exportZipPath, generateExport } from '../lib/media/instagram-export';
import { INSTAGRAM_FORMATS } from '../lib/media/instagram-slides';
import { HEX_COLOR } from '../lib/media/process';
import { requireFeatureAccess } from '../lib/premium/access';
import { Buckets } from '../lib/storage';
import { createAdminClient } from '../lib/supabase/server';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/instagram. Membership is checked by tripGuard (app.ts).
// Port of src/app/api/trips/[id]/instagram/exports/**.
export const tripsInstagramRouter = new Hono<AppEnv>();

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
const RUNNING_WINDOW_MS = 5 * 60 * 1000;
/** A job still "processing" after this long died with its process. */
const STALE_AFTER_MS = 5 * 60 * 1000;
const MAX_LINK_SECONDS = 24 * 60 * 60;

const TextOverlaySchema = z.object({
    text: z.string().trim().min(1).max(120),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']).default('bottom-left'),
    fontSize: z.number().int().min(12).max(120).default(48),
    color: z.string().regex(HEX_COLOR).default('#FFFFFF'),
    backgroundColor: z.string().regex(HEX_COLOR).optional(),
});

const CreateExportSchema = z.object({
    mediaIds: z.array(z.string().uuid()).min(1).max(INSTAGRAM_FORMATS.carousel.maxSlides),
    format: z.enum(['carousel', 'story']),
    filter: z.enum(['none', 'warm', 'cool', 'vintage', 'bw', 'vivid']).default('none'),
    textOverlay: TextOverlaySchema.optional(),
    generateCaption: z.boolean().default(false),
    language: z.enum(['it', 'en']).default('it'),
});

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

/** GET /api/trips/:id/instagram/exports — the trip's recent exports */
tripsInstagramRouter.get(
    '/exports',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const { data, error } = await c.get('supabase')
            .from('instagram_exports')
            .select('id, type, status, created_at, expires_at')
            .eq('trip_id', requireParam(c, 'id'))
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw new Error(`[motonui][instagram][GET] ${error.message}`);
        return ok(c, data ?? []);
    }, 'trips/:id/instagram/exports GET')
);

/**
 * POST /api/trips/:id/instagram/exports — starts an export job.
 * Answers 202 with the job id right away; the photos are processed after the
 * response and the client polls `…/exports/:exportId` for the ZIP.
 */
tripsInstagramRouter.post(
    '/exports',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = c.get('user');
        const id = requireParam(c, 'id');

        const parsed = CreateExportSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));
        const body = parsed.data;

        if (body.generateCaption) {
            await requireFeatureAccess({ userId: user.id, feature: 'instagram_caption', allowAdminBypass: true });
        }

        // One running export per trip: sharp on 10 photos is the heaviest job we run.
        const { count } = await supabase
            .from('instagram_exports')
            .select('id', { count: 'exact', head: true })
            .eq('trip_id', id)
            .eq('status', 'processing')
            .gt('created_at', new Date(Date.now() - RUNNING_WINDOW_MS).toISOString());
        if ((count ?? 0) > 0) {
            throw new AppError('Un export è già in corso per questo viaggio. Attendi qualche secondo 🏝️', 'EXPORT_RUNNING', 429);
        }

        const { data: job, error } = await supabase
            .from('instagram_exports')
            .insert({
                trip_id: id,
                created_by: user.id,
                type: body.format,
                media_ids: body.mediaIds,
                options: { filter: body.filter, textOverlay: body.textOverlay ?? null, language: body.language },
                status: 'processing',
                expires_at: new Date(Date.now() + EXPORT_TTL_MS).toISOString(),
            })
            .select('id, status, expires_at')
            .single();
        if (error || !job) throw new Error(`[motonui][instagram][POST] ${error?.message ?? 'insert failed'}`);

        runInBackground('instagram-export', async () => {
            // Background job: service role (the row and trip are already authorized).
            const admin = createAdminClient();
            try {
                const result = await generateExport({
                    admin,
                    exportId: job.id,
                    tripId: id,
                    mediaIds: body.mediaIds,
                    format: body.format,
                    filter: body.filter,
                    textOverlay: body.textOverlay,
                    generateCaption: body.generateCaption,
                    language: body.language,
                });
                await admin
                    .from('instagram_exports')
                    .update({
                        status: 'ready',
                        zip_path: result.zipPath,
                        caption: result.captionResult?.caption ?? null,
                        hashtags: result.captionResult?.hashtags ?? [],
                    })
                    .eq('id', job.id);
            } catch (err) {
                log.error('[motonui][instagram][export] failed', job.id, err);
                await admin
                    .from('instagram_exports')
                    .update({
                        status: 'failed',
                        error: err instanceof AppError ? err.message : 'Ops! Non siamo riusciti a creare lo ZIP. Riprova tra poco 🏝️',
                    })
                    .eq('id', job.id);
            }
        });

        return ok(c, job, 202);
    }, 'trips/:id/instagram/exports POST')
);

/**
 * GET /api/trips/:id/instagram/exports/:exportId — job status, polled by the
 * generator. When ready, returns a signed download URL valid until the ZIP
 * expires (max 24 h); the bucket is private (migration 0023).
 */
tripsInstagramRouter.get(
    '/exports/:exportId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const id = requireParam(c, 'id');
        const exportId = requireParam(c, 'exportId');

        const { data } = await c.get('supabase')
            .from('instagram_exports')
            .select('id, trip_id, type, status, created_at, expires_at, zip_path, caption, hashtags, error')
            .eq('id', exportId)
            .eq('trip_id', id)
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
        if (status === 'ready' && secondsLeft > 0 && job.zip_path === exportZipPath(id, job.id)) {
            const { data: signed } = await createAdminClient().storage
                .from(Buckets.instagramExports)
                .createSignedUrl(job.zip_path, Math.min(secondsLeft, MAX_LINK_SECONDS), { download: `motonui-${job.type}.zip` });
            downloadUrl = signed?.signedUrl ?? null;
        } else if (status === 'ready') {
            status = 'failed';
            error = 'Lo ZIP è scaduto: generane uno nuovo 🏝️';
        }

        return ok(c, {
            id: job.id,
            status,
            error: status === 'failed' ? error : null,
            caption: job.caption,
            hashtags: job.hashtags ?? [],
            expires_at: job.expires_at,
            download_url: downloadUrl,
        });
    }, 'trips/:id/instagram/exports/:exportId GET')
);
