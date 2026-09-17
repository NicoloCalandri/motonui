import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { requireFeatureAccess } from '../lib/premium/access';
import { withErrorHandler, ok } from '../lib/http';
import { Errors } from '../lib/errors';
import { generateExport } from '../lib/media/instagram-export';
import type { InstagramGenerateResponse } from '@motonui/shared-types';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

export const instagramRouter = new Hono<AppEnv>();

const GenerateSchema = z.object({
    tripId: z.string().uuid(),
    mediaIds: z.array(z.string().uuid()).min(1).max(10),
    type: z.enum(['carousel', 'story', 'reel']),
    options: z.record(z.unknown()).default({}),
    generateCaption: z.boolean().default(false),
    language: z.enum(['it', 'en']).default('it'),
});

/** POST /api/instagram/generate — kick off an Instagram export job */
instagramRouter.post(
    '/generate',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);

        const body: unknown = await c.req.json();
        const parsed = GenerateSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { tripId, mediaIds, type, options, generateCaption, language } = parsed.data;

        if (generateCaption) {
            await requireFeatureAccess({ userId: user.id, feature: 'instagram_caption', allowAdminBypass: true });
        }

        // Verify user is a trip member
        const { data: member } = await supabase
            .from('trip_members')
            .select('id')
            .eq('trip_id', tripId)
            .eq('user_id', user.id)
            .single();

        if (!member) throw Errors.forbidden();

        // Create export job record
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data: exportJob, error } = await (supabase.from('instagram_exports') as any)
            .insert({
                trip_id: tripId,
                created_by: user.id,
                type,
                media_ids: mediaIds,
                options,
                status: 'processing',
                expires_at: expiresAt,
            })
            .select()
            .single();

        if (error || !exportJob) throw new Error(`[motonui][instagram][POST] ${error?.message}`);

        try {
            const { downloadUrl, captionResult } = await generateExport({
                exportId: exportJob.id,
                tripId,
                mediaIds,
                type,
                options,
                generateCaption,
                language,
                supabase,
            });

            // Update export job with result
            await (supabase.from('instagram_exports') as any)
                .update({
                    status: 'ready',
                    zip_url: downloadUrl,
                    caption: captionResult?.caption ?? null,
                    hashtags: captionResult?.hashtags ?? [],
                })
                .eq('id', exportJob.id);

            const response: InstagramGenerateResponse = {
                exportId: exportJob.id,
                downloadUrl,
                caption: captionResult as any,
                expiresAt,
            };

            return ok(c, response);
        } catch (err) {
            // Mark job as failed
            await (supabase.from('instagram_exports') as any)
                .update({ status: 'failed' })
                .eq('id', exportJob.id);

            throw err;
        }
    }, 'instagram/generate POST')
);
