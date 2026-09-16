import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
};

/** POST /api/profile/avatar — uploads a new profile picture */
export const POST = withErrorHandler(async (request) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) throw Errors.validation('Nessun file allegato.');
    if (!ALLOWED_TYPES.has(file.type)) throw Errors.validation('Formato non supportato. Usa JPEG, PNG, WebP o HEIC.');
    if (file.size > MAX_SIZE) throw Errors.validation('Immagine troppo grande. Massimo 5 MB.');

    const ext = MIME_TO_EXT[file.type] ?? 'jpg';
    const storagePath = `${user.id}/avatar.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = await createAdminClient();
    const { error: uploadError } = await admin.storage
        .from('avatars')
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) throw new Error(`[motonui][profile/avatar POST] upload: ${uploadError.message}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Append a cache-busting timestamp so the browser reloads the image
    const avatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${storagePath}?t=${Date.now()}`;

    const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

    if (dbError) throw new Error(`[motonui][profile/avatar POST] db: ${dbError.message}`);

    return ok({ avatarUrl });
}, 'profile/avatar POST');
