import { Hono } from 'hono';
import { withErrorHandler, ok, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { createAnonClient } from '../lib/supabase/server';
import type { AppEnv } from '../types';

export const postsRouter = new Hono<AppEnv>();

/**
 * GET /api/posts/:slug — PUBLIC route, no auth required (matches the
 * isPublicRoute allowlist for /api/posts in the old root middleware.ts).
 * Uses the admin client since there's no user JWT to scope RLS with here.
 */
postsRouter.get(
    '/:slug',
    withErrorHandler(async (c) => {
        const supabase = createAnonClient();
        const slug = requireParam(c, 'slug');

        const { data: post, error } = await (supabase.from('posts') as any)
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
            const { data: related } = await (supabase.from('posts') as any)
                .select('id, title, slug, cover_image, published_at, reading_time')
                .eq('trip_id', post.trip_id)
                .eq('status', 'published')
                .neq('id', post.id)
                .limit(3);

            relatedPosts = related ?? [];
        }

        return ok(c, { post, relatedPosts });
    }, 'posts/:slug GET')
);
