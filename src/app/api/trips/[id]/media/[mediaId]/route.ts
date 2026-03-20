import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { Buckets } from '@/lib/storage';

type Params = { params: Promise<{ id: string; mediaId: string }> };

/** DELETE /api/trips/[id]/media/[mediaId] — delete a media item and its storage object */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, mediaId } = await params;

    // Fetch to get storage path before deleting
    const { data: media, error: fetchError } = await supabase
        .from('media')
        .select('url, trip_id')
        .eq('id', mediaId)
        .eq('trip_id', id)
        .single();

    if (fetchError || !media) throw Errors.notFound('Media');

    // Extract storage path from public URL and remove from Storage
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const prefix = `${supabaseUrl}/storage/v1/object/public/${Buckets.tripMedia}/`;
        if (media.url.startsWith(prefix)) {
            const storagePath = media.url.slice(prefix.length);
            await supabase.storage.from(Buckets.tripMedia).remove([storagePath]);
        }
    } catch {
        // Non-fatal: proceed to delete the DB record even if storage removal fails
    }

    const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', mediaId)
        .eq('trip_id', id);

    if (error) throw Errors.notFound('Media');

    return ok({ success: true });
}, 'trips/[id]/media/[mediaId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
