import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { getDestinationBriefing } from '@/lib/ai/destination';
import { ok, withErrorHandler, Errors } from '@/lib/errors';

const Schema = z.object({
    destination: z.string().min(1).max(200),
    language: z.enum(['it', 'en']).default('it'),
});

/** POST /api/ai/destination — returns a cached destination briefing */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const body: unknown = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const briefing = await getDestinationBriefing(parsed.data.destination, parsed.data.language, supabase);
    return ok(briefing);
}, 'ai/destination POST');
