import { after } from 'next/server';
import { z } from 'zod';
import { AppError, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { createAdminClient } from '@/lib/supabase/server';
import { requireFeatureAccess } from '@/lib/premium/access';
import { generateExport } from '@/lib/media/instagram-export';
import { INSTAGRAM_FORMATS } from '@/lib/media/instagram-slides';
import { HEX_COLOR } from '@/lib/media/process';

/** Photo processing runs after the 202 response, within this budget. */
export const maxDuration = 60;

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
const RUNNING_WINDOW_MS = 5 * 60 * 1000;

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

/** GET /api/trips/[id]/instagram/exports — the trip's recent exports */
export const GET = withRoute(
    { name: 'trips/[id]/instagram/exports GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
        const { data, error } = await supabase
            .from('instagram_exports')
            .select('id, type, status, created_at, expires_at')
            .eq('trip_id', params.id)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw new Error(`[motonui][instagram][GET] ${error.message}`);
        return ok(data ?? []);
    },
);

/**
 * POST /api/trips/[id]/instagram/exports — starts an export job (T-2.7).
 * Answers 202 with the job id right away; the photos are processed after the
 * response and the client polls `…/exports/[exportId]` for the ZIP.
 */
export const POST = withRoute(
    { name: 'trips/[id]/instagram/exports POST', params: tripParams(), body: CreateExportSchema, tripMember: true, rateLimit: 'instagramExport' },
    async ({ supabase, user, params, body }) => {
        if (body.generateCaption) {
            await requireFeatureAccess({ userId: user.id, feature: 'instagram_caption', allowAdminBypass: true });
        }

        // One running export per trip: sharp on 10 photos is the heaviest job we run.
        const { count } = await supabase
            .from('instagram_exports')
            .select('id', { count: 'exact', head: true })
            .eq('trip_id', params.id)
            .eq('status', 'processing')
            .gt('created_at', new Date(Date.now() - RUNNING_WINDOW_MS).toISOString());
        if ((count ?? 0) > 0) {
            throw new AppError('Un export è già in corso per questo viaggio. Attendi qualche secondo 🏝️', 'EXPORT_RUNNING', 429);
        }

        const { data: job, error } = await supabase
            .from('instagram_exports')
            .insert({
                trip_id: params.id,
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

        after(async () => {
            // Background job: service role (the row and trip are already authorized).
            const admin = await createAdminClient();
            try {
                const result = await generateExport({
                    admin,
                    exportId: job.id,
                    tripId: params.id,
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
                console.error('[motonui][instagram][export] failed', job.id, err);
                await admin
                    .from('instagram_exports')
                    .update({
                        status: 'failed',
                        error: err instanceof AppError ? err.message : 'Ops! Non siamo riusciti a creare lo ZIP. Riprova tra poco 🏝️',
                    })
                    .eq('id', job.id);
            }
        });

        return ok(job, 202);
    },
);
