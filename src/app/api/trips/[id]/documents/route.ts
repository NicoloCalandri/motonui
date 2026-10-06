import { Errors, ok, created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { formatZodError } from '@/lib/validation';
import { boardingPassExtension } from '@/lib/boarding-pass';
import { Buckets, uploadPrivateFile, validateFile } from '@/lib/storage';
import { buildDocumentPath } from '@/lib/trip-files';
import { removeDocumentFile } from '@/lib/trip-storage';
import { CreateFileDocumentSchema, CreateLinkDocumentSchema } from './schema';

/** Matches file_size_limit of the trip-documents bucket (migration 0017). */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** GET /api/trips/[id]/documents — list all documents for a trip */
export const GET = withRoute(
    { name: 'trips/[id]/documents GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('trip_id', params.id)
            .order('valid_from', { ascending: true });

        if (error) throw new Error(`[motonui][documents][GET] ${error.message}`);
        return ok(data ?? []);
    },
);

/**
 * POST /api/trips/[id]/documents — create a document.
 * - `application/json`: a document with an external https link (`file_url`)
 * - `multipart/form-data`: an uploaded file (`file`) stored in the private
 *   trip-documents bucket under a server-built, non-guessable path (T-2.3)
 */
export const POST = withRoute(
    { name: 'trips/[id]/documents POST', params: tripParams(), tripMember: true, rateLimit: 'fileUpload' },
    async ({ request, supabase, user, params }) => {
        const isUpload = (request.headers.get('content-type') ?? '').startsWith('multipart/form-data');

        if (!isUpload) {
            const parsed = CreateLinkDocumentSchema.safeParse(await request.json().catch(() => null));
            if (!parsed.success) throw Errors.validation(formatZodError(parsed.error));

            const { data: doc, error } = await supabase
                .from('documents')
                .insert({ ...parsed.data, file_path: null, trip_id: params.id, uploaded_by: user.id })
                .select()
                .single();

            if (error) throw new Error(`[motonui][documents][POST] ${error.message}`);
            return created(doc);
        }

        const form = await request.formData();
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

        const filePath = buildDocumentPath(params.id, extension);
        await uploadPrivateFile(Buckets.tripDocuments, filePath, buffer, file.type);

        const { data: doc, error } = await supabase
            .from('documents')
            .insert({
                ...parsed.data,
                file_path: filePath,
                file_url: null,
                file_type: extension === 'pdf' ? 'pdf' : 'image',
                trip_id: params.id,
                uploaded_by: user.id,
            })
            .select()
            .single();

        if (error) {
            await removeDocumentFile(params.id, filePath);
            throw new Error(`[motonui][documents][POST] ${error.message}`);
        }
        return created(doc);
    },
);
