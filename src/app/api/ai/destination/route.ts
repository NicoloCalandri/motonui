import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getDestinationBriefing } from '@/lib/ai/destination';
import { ok, withErrorHandler, Errors } from '@/lib/errors';

const Schema = z.object({
    destination: z.string().min(1).max(200),
    language: z.enum(['it', 'en']).default('it'),
});

/** POST /api/ai/destination — returns a cached destination briefing */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const body: unknown = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const briefing = await getDestinationBriefing(parsed.data.destination, parsed.data.language, supabase);
    return ok(briefing);
}, 'ai/destination POST');
