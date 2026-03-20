import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';

type Params = { params: Promise<{ id: string; postId: string }> };

/** DELETE /api/trips/[id]/posts/[postId] — delete a blog post belonging to this trip */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, postId } = await params;

    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('trip_id', id)
        .eq('author_id', user.id);

    if (error) throw Errors.notFound('Post');

    return ok({ success: true });
}, 'trips/[id]/posts/[postId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
