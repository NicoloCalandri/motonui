import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
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
export const POST = withRoute(
    { name: 'ai/blog POST', body: Schema },
    async ({ supabase, user, body }) => {
    await requireFeatureAccess({ userId: user.id, feature: 'ai_blog', allowAdminBypass: true });

    // Rate limit check (Sonnet: 50/day per user)
    const allowed = await checkRateLimit(user.id, 'sonnet', supabase);
    if (!allowed) throw Errors.rateLimited();

    const stream = streamBlogAssistant(body);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
});
