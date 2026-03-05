import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok } from '@/lib/errors';

type Params = { params: Promise<{ slug: string }> };

/** GET /api/posts/[slug] — PUBLIC route, no auth required */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const { slug } = await params;

    const { data: post, error } = await supabase
        .from('posts')
        .select(`
      id, title, slug, content_json, cover_image, published_at, reading_time,
      seo_title, seo_description, og_description,
      trip_id,
      trips (id, title, destination)
    `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

    if (error || !post) throw Errors.notFound('Post');

    // Related posts from same trip
    let relatedPosts: unknown[] = [];
    if (post.trip_id) {
        const { data: related } = await supabase
            .from('posts')
            .select('id, title, slug, cover_image, published_at, reading_time')
            .eq('trip_id', post.trip_id)
            .eq('status', 'published')
            .neq('id', post.id)
            .limit(3);

        relatedPosts = related ?? [];
    }

    return ok({ post, relatedPosts });
}, 'posts/[slug] GET') as (req: Request, ctx: Params) => Promise<Response>;
