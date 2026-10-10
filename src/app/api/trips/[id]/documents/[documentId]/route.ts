import { Errors, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { removeDocumentFile } from '@/lib/trip-storage';
import { UpdateDocumentSchema } from '../schema';

const params = tripParams('documentId');

/** PUT /api/trips/[id]/documents/[documentId] — the uploaded file itself cannot be replaced */
export const PUT = withRoute(
    { name: 'trips/[id]/documents/[documentId] PUT', params, body: UpdateDocumentSchema, tripMember: true },
    async ({ supabase, params, body }) => {
        const { data: doc, error } = await supabase
            .from('documents')
            .update(body)
            .eq('id', params.documentId)
            .eq('trip_id', params.id)
            .select()
            .single();

        if (error || !doc) throw Errors.notFound('Documento');
        return ok(doc);
    },
);

/** DELETE /api/trips/[id]/documents/[documentId] — deletes the row and its uploaded file (T-2.3) */
export const DELETE = withRoute(
    { name: 'trips/[id]/documents/[documentId] DELETE', params, tripMember: true },
    async ({ supabase, params }) => {
        const { data: doc, error } = await supabase
            .from('documents')
            .delete()
            .eq('id', params.documentId)
            .eq('trip_id', params.id)
            .select('file_path')
            .maybeSingle();

        if (error || !doc) throw Errors.notFound('Documento');

        await removeDocumentFile(params.id, doc.file_path);
        return ok({ success: true });
    },
);
