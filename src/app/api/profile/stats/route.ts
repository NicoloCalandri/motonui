import { withErrorHandler, ok } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

/** GET /api/profile/stats — trip and post counts for the current user */
export const GET = withErrorHandler(async () => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const [tripsRes, postsRes] = await Promise.all([
        supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
    ]);

    return ok({ trips: tripsRes.count ?? 0, posts: postsRes.count ?? 0 });
}, 'profile/stats GET');
