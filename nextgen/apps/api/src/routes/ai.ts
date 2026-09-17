import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { streamBlogAssistant, checkRateLimit } from '../lib/ai/blog-assistant';
import { getDestinationBriefing } from '../lib/ai/destination';
import { generateTripSummary } from '../lib/ai/trip-summary';
import { requireFeatureAccess } from '../lib/premium/access';
import { withErrorHandler, ok } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

export const aiRouter = new Hono<AppEnv>();

const BlogSchema = z.object({
    command: z.enum(['continue', 'improve', 'summarize', 'expand']),
    selectedText: z.string().max(5000).optional(),
    context: z.string().max(5000).optional(),
    language: z.enum(['it', 'en']).default('it'),
});

/**
 * POST /api/ai/blog — Streams Claude blog writing suggestions.
 * Returns Server-Sent Events (text/event-stream).
 *
 * NOTE: ported faithfully from the original, which does NOT wrap this
 * handler in withErrorHandler (unlike the other two AI routes below) — a
 * thrown AppError (e.g. PREMIUM_REQUIRED from requireFeatureAccess) falls
 * through to a generic error response rather than its real status/message.
 * Hono's default onError reproduces the same "falls through to a generic
 * 500" behavior, so this is a faithful port of a pre-existing bug, not a
 * regression — flagged here rather than silently fixed.
 */
aiRouter.post('/blog', requireUser, loadProfile, async (c) => {
    const supabase = c.get('supabase');
    const user = await getAuthUser(supabase);
    await requireFeatureAccess({ userId: user.id, feature: 'ai_blog', allowAdminBypass: true });

    const body: unknown = await c.req.json();
    const parsed = BlogSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: parsed.error.message }, 400);
    }

    // Rate limit check (Sonnet: 50/day per user)
    const allowed = await checkRateLimit(user.id, 'sonnet', supabase);
    if (!allowed) {
        const err = Errors.rateLimited();
        return c.json({ error: err.message }, 429);
    }

    const stream = streamBlogAssistant(parsed.data);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
});

const DestinationSchema = z.object({
    destination: z.string().min(1).max(200),
    language: z.enum(['it', 'en']).default('it'),
});

/** POST /api/ai/destination — returns a cached destination briefing */
aiRouter.post(
    '/destination',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        await requireFeatureAccess({ userId: user.id, feature: 'ai_destination', allowAdminBypass: true });

        const body: unknown = await c.req.json();
        const parsed = DestinationSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const briefing = await getDestinationBriefing(parsed.data.destination, parsed.data.language, supabase);
        return ok(c, briefing);
    }, 'ai/destination POST')
);

const GeneratePostSchema = z.object({
    tripId: z.string().uuid(),
    language: z.enum(['it', 'en']).default('it'),
    save: z.boolean().default(false),
    title: z.string().min(1).max(300).optional(),
    slug: z.string().min(1).max(300).optional(),
});

/** POST /api/ai/generate-post — generates a full blog post from trip data */
aiRouter.post(
    '/generate-post',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        await requireFeatureAccess({ userId: user.id, feature: 'ai_generate_post', allowAdminBypass: true });

        const body: unknown = await c.req.json();
        const parsed = GeneratePostSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { tripId, language, save, title, slug } = parsed.data;

        // Rate limit check (Sonnet: 50/day)
        const allowed = await checkRateLimit(user.id, 'sonnet', supabase);
        if (!allowed) throw Errors.rateLimited();

        // Fetch trip context
        const { data: trip } = await (supabase.from('trips') as any)
            .select(`*, days(*, legs(*)), expenses(amount_eur, amount, category)`)
            .eq('id', tripId)
            .single();

        if (!trip) throw Errors.notFound('Viaggio');

        // Build context for the AI
        const totalEur = (trip.expenses ?? []).reduce(
            (sum: number, e: { amount_eur?: number; amount: number }) => sum + (e.amount_eur ?? e.amount), 0
        );

        const content = await generateTripSummary(
            {
                title: trip.title,
                destination: trip.destination,
                startDate: trip.start_date,
                endDate: trip.end_date,
                description: trip.description,
                days: (trip.days ?? []).map((d: { date: string; title?: string; legs?: Array<{ from_name: string; to_name: string; type: string }> }) => ({
                    date: d.date,
                    title: d.title,
                    legs: (d.legs ?? []).map((l) => ({ from: l.from_name, to: l.to_name, type: l.type })),
                })),
                expenses: { total_eur: totalEur, top_categories: [], countries_visited: [] },
            },
            language
        );

        // Optionally save as draft post
        if (save) {
            const postSlug = slug ?? `${trip.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}-${Date.now()}`;
            const postTitle = title ?? `${trip.title} — Diario di viaggio`;

            const { data: post } = await (supabase.from('posts') as any)
                .insert({
                    trip_id: tripId,
                    author_id: user.id,
                    title: postTitle,
                    slug: postSlug,
                    content_json: content,
                    status: 'draft',
                })
                .select()
                .single();

            return ok(c, { content, post });
        }

        return ok(c, { content });
    }, 'ai/generate-post POST')
);
