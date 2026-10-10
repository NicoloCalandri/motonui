import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { ok, created } from '@/lib/errors';
import { postContentSchema } from '@/lib/blog/content-schema';

const CreatePostSchema = z.object({
    title: z.string().min(1).max(300),
    slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
    content_json: postContentSchema.optional(),
    cover_image: z.string().url().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
});

/** GET /api/trips/[id]/posts — list posts for a trip */
export const GET = withRoute(
    { name: 'trips/[id]/posts GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;
    const { data, error } = await supabase
        .from('posts')
        .select('id, title, slug, status, published_at, cover_image, reading_time, created_at')
        .eq('trip_id', id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[motonui][posts][GET] ${error.message}`);

    return ok(data ?? []);
});

/** POST /api/trips/[id]/posts — create a blog post */
export const POST = withRoute(
    { name: 'trips/[id]/posts POST', params: tripParams(), body: CreatePostSchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id } = params;

    const { data: post, error } = await supabase
        .from('posts')
        .insert({
            ...body,
            content_json: body.content_json ?? null,
            trip_id: id,
            author_id: user.id,
            published_at: body.status === 'published' ? new Date().toISOString() : null,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][posts][POST] ${error.message}`);

    return created(post);
});
