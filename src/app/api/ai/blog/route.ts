import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { streamBlogAssistant, checkRateLimit } from '@/lib/ai/blog-assistant';
import { Errors } from '@/lib/errors';

const Schema = z.object({
    command: z.enum(['continue', 'improve', 'summarize', 'expand']),
    selectedText: z.string().max(5000).optional(),
    context: z.string().max(5000).optional(),
    language: z.enum(['it', 'en']).default('it'),
});

/**
 * POST /api/ai/blog — Streams Claude blog writing suggestions.
 * Returns Server-Sent Events (text/event-stream).
 */
export async function POST(request: Request): Promise<Response> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Non autenticato' }, { status: 401 });

    const body: unknown = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: parsed.error.message }, { status: 400 });
    }

    // Rate limit check (Sonnet: 50/day per user)
    const allowed = await checkRateLimit(user.id, 'sonnet', supabase);
    if (!allowed) {
        const err = Errors.rateLimited();
        return Response.json({ error: err.message }, { status: 429 });
    }

    const stream = streamBlogAssistant(parsed.data);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
