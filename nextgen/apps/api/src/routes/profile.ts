import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok } from '../lib/http';
import { Errors } from '../lib/errors';
import { createAdminClient } from '../lib/supabase/server';
import { env } from '../lib/env';
import { requireUser } from '../middleware/auth';
import type { AppEnv } from '../types';

export const profileRouter = new Hono<AppEnv>();

const UpdateProfileSchema = z.object({
    fullName: z.string().trim().min(1).max(100),
});

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

const AVATAR_MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
};

/** GET /api/profile — returns current user's id, email, full_name, avatar_url */
profileRouter.get(
    '/',
    requireUser,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);

        const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', user.id)
            .single();

        return ok(c, {
            id: user.id,
            email: user.email ?? null,
            fullName: profile?.display_name ?? '',
            avatarUrl: profile?.avatar_url ?? null,
        });
    }, 'profile GET')
);

/** PATCH /api/profile — updates display_name in the profiles table */
profileRouter.patch(
    '/',
    requireUser,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = c.get('user');

        const body: unknown = await c.req.json();
        const parsed = UpdateProfileSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { error } = await (supabase as any)
            .from('profiles')
            .update({ display_name: parsed.data.fullName })
            .eq('id', user.id);

        if (error) throw new Error(`[motonui][profile PATCH] ${error.message}`);

        return ok(c, { fullName: parsed.data.fullName });
    }, 'profile PATCH')
);

/** POST /api/profile/avatar — uploads a new profile picture */
profileRouter.post(
    '/avatar',
    requireUser,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);

        const formData = await c.req.formData();
        const file = formData.get('avatar');

        if (!(file instanceof File)) throw Errors.validation('Nessun file allegato.');
        if (!ALLOWED_AVATAR_TYPES.has(file.type)) throw Errors.validation('Formato non supportato. Usa JPEG, PNG, WebP o HEIC.');
        if (file.size > MAX_AVATAR_SIZE) throw Errors.validation('Immagine troppo grande. Massimo 5 MB.');

        const ext = AVATAR_MIME_TO_EXT[file.type] ?? 'jpg';
        const storagePath = `${user.id}/avatar.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const admin = createAdminClient();
        const { error: uploadError } = await admin.storage
            .from('avatars')
            .upload(storagePath, buffer, { contentType: file.type, upsert: true });

        if (uploadError) throw new Error(`[motonui][profile/avatar POST] upload: ${uploadError.message}`);

        // Append a cache-busting timestamp so the browser reloads the image
        const avatarUrl = `${env.SUPABASE_URL}/storage/v1/object/public/avatars/${storagePath}?t=${Date.now()}`;

        const { error: dbError } = await (supabase as any)
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', user.id);

        if (dbError) throw new Error(`[motonui][profile/avatar POST] db: ${dbError.message}`);

        return ok(c, { avatarUrl });
    }, 'profile/avatar POST')
);

/** GET /api/profile/stats — trip and post counts for the current user */
profileRouter.get(
    '/stats',
    requireUser,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);

        const [tripsRes, postsRes] = await Promise.all([
            supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
        ]);

        return ok(c, { trips: tripsRes.count ?? 0, posts: postsRes.count ?? 0 });
    }, 'profile/stats GET')
);
