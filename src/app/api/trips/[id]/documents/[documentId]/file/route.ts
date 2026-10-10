import { z } from 'zod';
import { Errors } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { boardingPassMimeType } from '@/lib/boarding-pass';
import { Buckets, downloadFile } from '@/lib/storage';
import { isTripFilePath } from '@/lib/trip-files';

/**
 * GET /api/trips/[id]/documents/[documentId]/file[?download=1]
 * Streams an uploaded document from the private bucket after the auth and
 * membership check; the stored path is re-checked against the trip prefix.
 */
export const GET = withRoute(
    {
        name: 'trips/[id]/documents/[documentId]/file GET',
        params: tripParams('documentId'),
        query: z.object({ download: z.literal('1').optional() }),
        tripMember: true,
    },
    async ({ supabase, params, query }) => {
        const { data: doc } = await supabase
            .from('documents')
            .select('file_path')
            .eq('id', params.documentId)
            .eq('trip_id', params.id)
            .maybeSingle();

        const filePath = doc?.file_path;
        if (!isTripFilePath(filePath, params.id, 'documents')) throw Errors.notFound('Documento');

        const file = await downloadFile(Buckets.tripDocuments, filePath);
        if (!file) throw Errors.notFound('Documento');

        const extension = filePath.split('.').pop();
        return new Response(file.stream(), {
            status: 200,
            headers: {
                'Content-Type': boardingPassMimeType(filePath),
                'Content-Disposition': `${query.download ? 'attachment' : 'inline'}; filename="documento.${extension}"`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    },
);
