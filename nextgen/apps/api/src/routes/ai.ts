import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { streamBlogAssistant } from '../lib/ai/blog-assistant';
import { getDestinationBriefing } from '../lib/ai/destination';
import { generateTripSummary } from '../lib/ai/trip-summary';
import { requireTripMember } from '../lib/authz';
import { fromCents } from '../lib/currency';
import { eurCents } from '../lib/expenses';
import { toJson } from '../lib/json';
import { requireFeatureAccess } from '../lib/premium/access';
import { withErrorHandler, ok, readJsonObject, issueSummary } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/ai. Ports of src/app/api/ai/*/route.ts: the burst limit
// ('ai' bucket) is declared in app.ts, the daily quota is consumed by
// requireFeatureAccess (RPC consume_feature_quota) and by nothing else.
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
 * Not wrapped in withErrorHandler (the success path is a stream, not JSON):
 * errors thrown before the stream starts reach the app error handler, which
 * answers with their real status and the standard body.
 */
aiRouter.post('/blog', requireUser, loadProfile, async (c) => {
    const user = await getAuthUser(c.get('supabase'));

    // Input first: a bad request must not consume the daily quota.
    const parsed = BlogSchema.safeParse(await readJsonObject(c));
    if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

    await requireFeatureAccess({ userId: user.id, feature: 'ai_blog', allowAdminBypass: true });

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

        // Input first: a bad request must not consume the daily quota.
        const parsed = DestinationSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

        await requireFeatureAccess({ userId: user.id, feature: 'ai_destination', allowAdminBypass: true });

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

        // Input first: a bad request must not consume the daily quota.
        const parsed = GeneratePostSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

        const { tripId, language, save, title, slug } = parsed.data;

        // The trip comes from the body, so membership is checked here rather than by the trip guard.
        await requireTripMember(supabase, tripId, user.id);
        await requireFeatureAccess({ userId: user.id, feature: 'ai_generate_post', allowAdminBypass: true });

        // Fetch trip context
        const { data: trip } = await supabase
            .from('trips')
            .select(`*, days(*, legs(*)), expenses(amount_eur, amount, currency)`)
            .eq('id', tripId)
            .single();

        if (!trip) throw Errors.notFound('Viaggio');

        // Build context for the AI
        // Same rules as the expense summary: cents, expenses without a rate left out (T-3.2).
        const totalEur = fromCents((trip.expenses ?? []).reduce((sum, e) => sum + (eurCents(e) ?? 0), 0));

        const content = await generateTripSummary(
            {
                title: trip.title,
                destination: trip.destination,
                startDate: trip.start_date ?? undefined,
                endDate: trip.end_date ?? undefined,
                description: trip.description ?? undefined,
                days: (trip.days ?? []).map((d) => ({
                    date: d.date,
                    title: d.title ?? undefined,
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

            const { data: post } = await supabase
                .from('posts')
                .insert({
                    trip_id: tripId,
                    author_id: user.id,
                    title: postTitle,
                    slug: postSlug,
                    content_json: toJson(content),
                    status: 'draft',
                })
                .select()
                .single();

            return ok(c, { content, post });
        }

        return ok(c, { content });
    }, 'ai/generate-post POST')
);
