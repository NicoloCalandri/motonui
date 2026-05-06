import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';

const UpdatePostSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    status: z.enum(['draft', 'published']).optional(),
    content_json: z.any().optional(),
    published_at: z.string().nullable().optional(),
    seo_title: z.string().max(60).nullable().optional(),
    seo_description: z.string().max(160).nullable().optional(),
});

type Params = { params: Promise<{ id: string; postId: string }> };

/** GET /api/trips/[id]/posts/[postId] — get a single blog post */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, postId } = await params;

    const { data: post, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('trip_id', id)
        .eq('author_id', user.id)
        .single();

    if (error || !post) throw Errors.notFound('Post');

    return ok(post);
}, 'trips/[id]/posts/[postId] GET') as (req: Request, ctx: Params) => Promise<Response>;

/** PUT /api/trips/[id]/posts/[postId] — update a blog post */
export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, postId } = await params;

    const body: unknown = await request.json();
    const parsed = UpdatePostSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: post, error } = await supabase
        .from('posts')
        .update({
            ...parsed.data,
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
}, 'trips/[id]/posts/[postId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

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
