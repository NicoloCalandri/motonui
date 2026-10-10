import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { getDestinationBriefing } from '@/lib/ai/destination';
import { requireFeatureAccess } from '@/lib/premium/access';
import { ok } from '@/lib/errors';

const Schema = z.object({
    destination: z.string().min(1).max(200),
    language: z.enum(['it', 'en']).default('it'),
});

/** POST /api/ai/destination — returns a cached destination briefing */
export const POST = withRoute(
    { name: 'ai/destination POST', body: Schema, rateLimit: 'ai' },
    async ({ supabase, user, body }) => {
    await requireFeatureAccess({ userId: user.id, feature: 'ai_destination', allowAdminBypass: true });

    const briefing = await getDestinationBriefing(body.destination, body.language, supabase);
    return ok(briefing);
});
