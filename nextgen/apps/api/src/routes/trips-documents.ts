import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam, readJsonObject, readFormData } from '../lib/http';
import { Errors } from '../lib/errors';
import { formatZodError } from '../lib/validation';
import { boardingPassExtension, boardingPassMimeType } from '../lib/boarding-pass';
import { Buckets, downloadFile, uploadPrivateFile, validateFile } from '../lib/storage';
import { buildDocumentPath, isTripFilePath } from '../lib/trip-files';
import { removeDocumentFile } from '../lib/trip-storage';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/documents. Membership is checked by tripGuard (app.ts).
// Port of src/app/api/trips/[id]/documents/**.
export const tripsDocumentsRouter = new Hono<AppEnv>();

/** Matches file_size_limit of the trip-documents bucket (migration 0017). */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** External document links must be https (no javascript:, data:, http:). */
const httpsUrl = z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => value.toLowerCase().startsWith('https://'), 'il link deve iniziare con https://');

const documentFields = {
    entity_type: z.enum(['leg', 'accommodation', 'restaurant', 'activity', 'trip']).optional().nullable(),
    entity_id: z.string().uuid().optional().nullable(),
    type: z.enum(['boarding_pass', 'hotel_voucher', 'ticket', 'reservation_confirmation', 'insurance', 'visa', 'other']),
    title: z.string().trim().min(1).max(200),
    file_type: z.enum(['pdf', 'image']).default('image'),
    valid_from: z.string().date().optional().nullable(),
    valid_until: z.string().date().optional().nullable(),
    barcode_data: z.string().max(1000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
};

/** JSON body: a document that points to an external https link. */
const CreateLinkDocumentSchema = z.object({ ...documentFields, file_url: httpsUrl });

/** Multipart fields of an uploaded document (the file itself is checked apart). */
const CreateFileDocumentSchema = z.object(documentFields).omit({ file_type: true });

const UpdateDocumentSchema = z
    .object({ ...documentFields, file_url: httpsUrl })
    .omit({ file_type: true })
    .partial();

/** GET /api/trips/:id/documents — list all documents for a trip */
tripsDocumentsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');

        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('trip_id', id)
            .order('valid_from', { ascending: true });

        if (error) throw new Error(`[motonui][documents][GET] ${error.message}`);
        return ok(c, data ?? []);
    }, 'trips/:id/documents GET')
);

/**
 * POST /api/trips/:id/documents — create a document.
 * - `application/json`: a document with an external https link (`file_url`)
 * - `multipart/form-data`: an uploaded file (`file`) stored in the private
 *   trip-documents bucket under a server-built, non-guessable path
 */
tripsDocumentsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const isUpload = (c.req.header('content-type') ?? '').startsWith('multipart/form-data');

        if (!isUpload) {
            const parsed = CreateLinkDocumentSchema.safeParse(await readJsonObject(c));
            if (!parsed.success) throw Errors.validation(formatZodError(parsed.error));

            const { data: doc, error } = await supabase
                .from('documents')
                .insert({ ...parsed.data, file_path: null, trip_id: id, uploaded_by: user.id })
                .select()
                .single();

            if (error) throw new Error(`[motonui][documents][POST] ${error.message}`);
            return created(c, doc);
        }

        const form = await readFormData(c);
        const file = form.get('file');
        if (!(file instanceof File)) throw Errors.validation('Campo "file" mancante.');

        const fields = Object.fromEntries(
            [...form.entries()].filter(([key, value]) => key !== 'file' && typeof value === 'string' && value !== ''),
        );
        const parsed = CreateFileDocumentSchema.safeParse(fields);
        if (!parsed.success) throw Errors.validation(formatZodError(parsed.error));

        const extension = boardingPassExtension(file.type);
        if (!extension) throw Errors.validation("Carica un'immagine (JPEG, PNG, WebP, HEIC) o un PDF.");
        if (file.size > MAX_DOCUMENT_BYTES) throw Errors.validation('Il file supera i 20 MB.');

        const buffer = Buffer.from(await file.arrayBuffer());
        validateFile(file.type, file.size, buffer);

        const filePath = buildDocumentPath(id, extension);
        await uploadPrivateFile(Buckets.tripDocuments, filePath, buffer, file.type);

        const { data: doc, error } = await supabase
            .from('documents')
            .insert({
                ...parsed.data,
                file_path: filePath,
                file_url: null,
                file_type: extension === 'pdf' ? 'pdf' : 'image',
                trip_id: id,
                uploaded_by: user.id,
            })
            .select()
            .single();

        if (error) {
            await removeDocumentFile(id, filePath);
            throw new Error(`[motonui][documents][POST] ${error.message}`);
        }
        return created(c, doc);
    }, 'trips/:id/documents POST')
);

/**
 * GET /api/trips/:id/documents/:documentId/file[?download=1]
 * Streams an uploaded document from the private bucket after the auth and
 * membership check; the stored path is re-checked against the trip prefix.
 */
tripsDocumentsRouter.get(
    '/:documentId/file',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');
        const documentId = requireParam(c, 'documentId');

        const { data: doc } = await supabase
            .from('documents')
            .select('file_path')
            .eq('id', documentId)
            .eq('trip_id', id)
            .maybeSingle();

        const filePath = doc?.file_path;
        if (!isTripFilePath(filePath, id, 'documents')) throw Errors.notFound('Documento');

        const file = await downloadFile(Buckets.tripDocuments, filePath);
        if (!file) throw Errors.notFound('Documento');

        const extension = filePath.split('.').pop();
        const download = c.req.query('download') === '1';
        return new Response(file.stream(), {
            status: 200,
            headers: {
                'Content-Type': boardingPassMimeType(filePath),
                'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="documento.${extension}"`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    }, 'trips/:id/documents/:documentId/file GET')
);

/** PUT /api/trips/:id/documents/:documentId — the uploaded file itself cannot be replaced */
tripsDocumentsRouter.put(
    '/:documentId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');
        const documentId = requireParam(c, 'documentId');

        const parsed = UpdateDocumentSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(formatZodError(parsed.error));

        const { data: doc, error } = await supabase
            .from('documents')
            .update(parsed.data)
            .eq('id', documentId)
            .eq('trip_id', id)
            .select()
            .single();

        if (error || !doc) throw Errors.notFound('Documento');
        return ok(c, doc);
    }, 'trips/:id/documents/:documentId PUT')
);

/** DELETE /api/trips/:id/documents/:documentId — deletes the row and its uploaded file */
tripsDocumentsRouter.delete(
    '/:documentId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');
        const documentId = requireParam(c, 'documentId');

        const { data: doc, error } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)
            .eq('trip_id', id)
            .select('file_path')
            .maybeSingle();

        if (error || !doc) throw Errors.notFound('Documento');

        await removeDocumentFile(id, doc.file_path);
        return ok(c, { success: true });
    }, 'trips/:id/documents/:documentId DELETE')
);
