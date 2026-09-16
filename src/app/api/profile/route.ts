import { z } from 'zod';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

const UpdateProfileSchema = z.object({
    fullName: z.string().trim().min(1).max(100),
});

/** GET /api/profile — returns current user's id, email, full_name, avatar_url */
export const GET = withErrorHandler(async () => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single();

    return ok({
        id: user.id,
        email: user.email ?? null,
        fullName: profile?.display_name ?? '',
        avatarUrl: profile?.avatar_url ?? null,
    });
}, 'profile GET');

/** PATCH /api/profile — updates display_name in the profiles table */
export const PATCH = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const body: unknown = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { error } = await supabase
        .from('profiles')
        .update({ display_name: parsed.data.fullName })
        .eq('id', user.id);

    if (error) throw new Error(`[motonui][profile PATCH] ${error.message}`);

    return ok({ fullName: parsed.data.fullName });
}, 'profile PATCH');
