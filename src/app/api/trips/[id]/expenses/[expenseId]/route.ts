import { ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';

export const DELETE = withRoute(
    { name: 'trips/[id]/expenses/[expenseId] DELETE', params: tripParams('expenseId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, expenseId } = params;

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][expenses][DELETE] ${error.message}`);

    return ok({ success: true });
});
