import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { removeMediaFiles } from '@/lib/trip-storage';

/** DELETE /api/trips/[id]/media/[mediaId] — delete a media item and its stored files */
export const DELETE = withRoute(
    { name: 'trips/[id]/media/[mediaId] DELETE', params: tripParams('mediaId'), tripMember: true },
    async ({ supabase, params }) => {
        const { id, mediaId } = params;

        const { data: media, error } = await supabase
            .from('media')
            .delete()
            .eq('id', mediaId)
            .eq('trip_id', id)
            .select('storage_path, thumb_path')
            .maybeSingle();

        if (error || !media) throw Errors.notFound('Media');

        // Paths come from the row but are re-checked against the trip prefix
        // before the service role touches storage (T-2.4).
        await removeMediaFiles(id, media);

        return ok({ success: true });
    },
);
