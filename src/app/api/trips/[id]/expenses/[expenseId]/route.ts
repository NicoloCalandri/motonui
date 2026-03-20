import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';

type Params = { params: Promise<{ id: string; expenseId: string }> };

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, expenseId } = await params;

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][expenses][DELETE] ${error.message}`);

    return ok({ success: true });
}, 'trips/[id]/expenses/[expenseId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
