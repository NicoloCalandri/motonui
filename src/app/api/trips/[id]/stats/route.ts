import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getTripStats } from '@/lib/trips';

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/stats — return aggregated trip statistics */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;
    const stats = await getTripStats(id);

    return ok(stats);
}, 'trips/[id]/stats GET') as (req: Request, ctx: Params) => Promise<Response>;
