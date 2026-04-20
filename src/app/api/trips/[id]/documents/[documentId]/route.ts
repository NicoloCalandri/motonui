import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';

const UpdateDocumentSchema = z.object({
    entity_type: z.enum(['leg', 'accommodation', 'restaurant', 'activity', 'trip']).optional().nullable(),
    entity_id: z.string().uuid().optional().nullable(),
    type: z.enum(['boarding_pass', 'hotel_voucher', 'ticket', 'reservation_confirmation', 'insurance', 'visa', 'other']).optional(),
    title: z.string().min(1).max(200).optional(),
    file_url: z.string().min(1).optional(),
    file_type: z.enum(['pdf', 'image']).optional(),
    valid_from: z.string().optional().nullable(),
    valid_until: z.string().optional().nullable(),
    barcode_data: z.string().max(1000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
});

type Params = { params: Promise<{ id: string; documentId: string }> };

/** PUT /api/trips/[id]/documents/[documentId] */
export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, documentId } = await params;
    await requireTripMember(supabase, id, user.id);

    const body: unknown = await request.json();
    const parsed = UpdateDocumentSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: doc, error } = await supabase
        .from('documents')
        .update(parsed.data)
        .eq('id', documentId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Documento');

    return ok(doc);
}, 'trips/[id]/documents/[documentId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

/** DELETE /api/trips/[id]/documents/[documentId] */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, documentId } = await params;
    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('trip_id', id);

    if (error) throw Errors.notFound('Documento');

    return ok({ success: true });
}, 'trips/[id]/documents/[documentId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
