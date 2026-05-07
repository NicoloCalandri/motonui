import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { streamBlogAssistant, checkRateLimit } from '@/lib/ai/blog-assistant';
import { requireFeatureAccess } from '@/lib/premium/access';
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
    const user = await getAuthUser(supabase);
    await requireFeatureAccess({ userId: user.id, feature: 'ai_blog', allowAdminBypass: true });

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
