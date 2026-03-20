import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';

type Params = { params: Promise<{ id: string; dayId: string }> };

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, dayId } = await params;

    const { error } = await supabase
        .from('days')
        .delete()
        .eq('id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][days][DELETE] ${error.message}`);

    return ok({ success: true });
}, 'trips/[id]/days/[dayId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
