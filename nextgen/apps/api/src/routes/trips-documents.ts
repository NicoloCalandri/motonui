import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/documents
export const tripsDocumentsRouter = new Hono<AppEnv>();

const CreateDocumentSchema = z.object({
    entity_type: z.enum(['leg', 'accommodation', 'restaurant', 'activity', 'trip']).optional().nullable(),
    entity_id: z.string().uuid().optional().nullable(),
    type: z.enum(['boarding_pass', 'hotel_voucher', 'ticket', 'reservation_confirmation', 'insurance', 'visa', 'other']),
    title: z.string().min(1).max(200),
    file_url: z.string().min(1),
    file_type: z.enum(['pdf', 'image']).default('image'),
    valid_from: z.string().optional().nullable(),
    valid_until: z.string().optional().nullable(),
    barcode_data: z.string().max(1000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
});

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

/** GET /api/trips/:id/documents — list all documents for a trip */
tripsDocumentsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('trip_id', id)
            .order('valid_from', { ascending: true });

        if (error) throw new Error(`[motonui][documents][GET] ${error.message}`);
        return ok(c, data ?? []);
    }, 'trips/:id/documents GET')
);

/** POST /api/trips/:id/documents — upload/create a document */
tripsDocumentsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
        const parsed = CreateDocumentSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: doc, error } = await supabase
            .from('documents')
            .insert({
                ...parsed.data,
                trip_id: id,
                uploaded_by: user.id,
            })
            .select()
            .single();

        if (error) throw new Error(`[motonui][documents][POST] ${error.message}`);

        return created(c, doc);
    }, 'trips/:id/documents POST')
);

/** PUT /api/trips/:id/documents/:documentId */
tripsDocumentsRouter.put(
    '/:documentId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const documentId = requireParam(c, 'documentId');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
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

        return ok(c, doc);
    }, 'trips/:id/documents/:documentId PUT')
);

/** DELETE /api/trips/:id/documents/:documentId */
tripsDocumentsRouter.delete(
    '/:documentId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const documentId = requireParam(c, 'documentId');
        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)
            .eq('trip_id', id);

        if (error) throw Errors.notFound('Documento');

        return ok(c, { success: true });
    }, 'trips/:id/documents/:documentId DELETE')
);
