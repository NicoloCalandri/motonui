import { z } from 'zod';
import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';

const UpdatePostSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    status: z.enum(['draft', 'published']).optional(),
    content_json: z.any().optional(),
    published_at: z.string().nullable().optional(),
    seo_title: z.string().max(60).nullable().optional(),
    seo_description: z.string().max(160).nullable().optional(),
});

/** GET /api/trips/[id]/posts/[postId] — get a single blog post */
export const GET = withRoute(
    { name: 'trips/[id]/posts/[postId] GET', params: tripParams('postId'), tripMember: true },
    async ({ supabase, user, params }) => {
    const { id, postId } = params;

    const { data: post, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('trip_id', id)
        .eq('author_id', user.id)
        .single();

    if (error || !post) throw Errors.notFound('Post');

    return ok(post);
});

/** PUT /api/trips/[id]/posts/[postId] — update a blog post */
export const PUT = withRoute(
    { name: 'trips/[id]/posts/[postId] PUT', params: tripParams('postId'), body: UpdatePostSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id, postId } = params;

    const { data: post, error } = await supabase
        .from('posts')
        .update({
            ...body,
            updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('trip_id', id)
        .eq('author_id', user.id)
        .select()
        .single();

    if (error) throw new Error(`[motonui][posts][PUT] ${error.message}`);
    if (!post) throw Errors.notFound('Post');

    return ok(post);
});

/** DELETE /api/trips/[id]/posts/[postId] — delete a blog post belonging to this trip */
export const DELETE = withRoute(
    { name: 'trips/[id]/posts/[postId] DELETE', params: tripParams('postId'), tripMember: true },
    async ({ supabase, user, params }) => {
    const { id, postId } = params;

    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('trip_id', id)
        .eq('author_id', user.id);

    if (error) throw Errors.notFound('Post');

    return ok({ success: true });
});
