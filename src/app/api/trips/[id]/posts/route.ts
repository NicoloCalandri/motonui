import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';

const CreatePostSchema = z.object({
    title: z.string().min(1).max(300),
    slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
    content_json: z.record(z.unknown()).optional(),
    cover_image: z.string().url().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
});

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/posts — list posts for a trip */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;

    const { data, error } = await supabase
        .from('posts')
        .select('id, title, slug, status, published_at, cover_image, reading_time, created_at')
        .eq('trip_id', id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[motonui][posts][GET] ${error.message}`);

    return ok(data ?? []);
}, 'trips/[id]/posts GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/posts — create a blog post */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = CreatePostSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: post, error } = await supabase
        .from('posts')
        .insert({
            ...parsed.data,
            trip_id: id,
            author_id: user.id,
            published_at: parsed.data.status === 'published' ? new Date().toISOString() : null,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][posts][POST] ${error.message}`);

    return created(post);
}, 'trips/[id]/posts POST') as (req: Request, ctx: Params) => Promise<Response>;
