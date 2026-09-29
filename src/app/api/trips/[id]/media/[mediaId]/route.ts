import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { Buckets } from '@/lib/storage';

/** DELETE /api/trips/[id]/media/[mediaId] — delete a media item and its storage object */
export const DELETE = withRoute(
    { name: 'trips/[id]/media/[mediaId] DELETE', params: tripParams('mediaId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, mediaId } = params;

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
        const storagePath = media.url.startsWith(prefix) ? media.url.slice(prefix.length) : null;
        // Only files of this trip: media.url is set by the client at insert time.
        if (storagePath && storagePath.startsWith(`trips/${id}/`) && !storagePath.includes('..')) {
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
});
