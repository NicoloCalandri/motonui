import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { sanitizeTiptapDocument } from '../lib/sanitize';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/posts
export const tripsPostsRouter = new Hono<AppEnv>();

const CreatePostSchema = z.object({
    title: z.string().min(1).max(300),
    slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
    content_json: z.record(z.unknown()).optional(),
    cover_image: z.string().url().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
});

const UpdatePostSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    status: z.enum(['draft', 'published']).optional(),
    content_json: z.any().optional(),
    published_at: z.string().nullable().optional(),
    seo_title: z.string().max(60).nullable().optional(),
    seo_description: z.string().max(160).nullable().optional(),
});

/** GET /api/trips/:id/posts — list posts for a trip */
tripsPostsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const { data, error } = await supabase
            .from('posts')
            .select('id, title, slug, status, published_at, cover_image, reading_time, created_at')
            .eq('trip_id', id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`[motonui][posts][GET] ${error.message}`);

        return ok(c, data ?? []);
    }, 'trips/:id/posts GET')
);

/** POST /api/trips/:id/posts — create a blog post */
tripsPostsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
        const parsed = CreatePostSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const contentJson = parsed.data.content_json ? sanitizeTiptapDocument(parsed.data.content_json) : null;

        const { data: post, error } = await supabase
            .from('posts')
            .insert({
                ...parsed.data,
                content_json: contentJson,
                trip_id: id,
                author_id: user.id,
                published_at: parsed.data.status === 'published' ? new Date().toISOString() : null,
            })
            .select()
            .single();

        if (error) throw new Error(`[motonui][posts][POST] ${error.message}`);

        return created(c, post);
    }, 'trips/:id/posts POST')
);

/**
 * GET /api/trips/:id/posts/:postId — get a single blog post
 * NOTE: ported as-is — no requireTripMember, relies on the
 * .eq('author_id', user.id) filter as its authorization check.
 */
tripsPostsRouter.get(
    '/:postId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const postId = requireParam(c, 'postId');

        const { data: post, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', postId)
            .eq('trip_id', id)
            .eq('author_id', user.id)
            .single();

        if (error || !post) throw Errors.notFound('Post');

        return ok(c, post);
    }, 'trips/:id/posts/:postId GET')
);

/** PUT /api/trips/:id/posts/:postId — update a blog post */
tripsPostsRouter.put(
    '/:postId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const postId = requireParam(c, 'postId');

        const body: unknown = await c.req.json();
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

        return ok(c, post);
    }, 'trips/:id/posts/:postId PUT')
);

/** DELETE /api/trips/:id/posts/:postId — delete a blog post belonging to this trip */
tripsPostsRouter.delete(
    '/:postId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const postId = requireParam(c, 'postId');

        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('trip_id', id)
            .eq('author_id', user.id);

        if (error) throw Errors.notFound('Post');

        return ok(c, { success: true });
    }, 'trips/:id/posts/:postId DELETE')
);
