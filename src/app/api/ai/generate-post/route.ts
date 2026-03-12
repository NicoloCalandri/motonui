import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateTripSummary } from '@/lib/ai/trip-summary';
import { checkRateLimit } from '@/lib/ai/blog-assistant';
import { ok, withErrorHandler, Errors } from '@/lib/errors';
import type { TripWithDetails } from '@/lib/types';

const Schema = z.object({
    tripId: z.string().uuid(),
    language: z.enum(['it', 'en']).default('it'),
    save: z.boolean().default(false),
    title: z.string().min(1).max(300).optional(),
    slug: z.string().min(1).max(300).optional(),
});

/** POST /api/ai/generate-post — generates a full blog post from trip data */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const body: unknown = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { tripId, language, save, title, slug } = parsed.data;

    // Rate limit check (Sonnet: 50/day)
    const allowed = await checkRateLimit(user.id, 'sonnet', supabase);
    if (!allowed) throw Errors.rateLimited();

    // Fetch trip context
    const { data: trip } = await supabase
        .from('trips')
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

        const { data: post } = await supabase
            .from('posts')
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

        return ok({ content, post });
    }

    return ok({ content });
}, 'ai/generate-post POST');
