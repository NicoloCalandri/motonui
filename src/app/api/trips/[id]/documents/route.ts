import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';

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

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/documents — list all documents for a trip */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('trip_id', id)
        .order('valid_from', { ascending: true });

    if (error) throw new Error(`[motonui][documents][GET] ${error.message}`);
    return ok(data ?? []);
}, 'trips/[id]/documents GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/documents — upload/create a document */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const body: unknown = await request.json();
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

    return created(doc);
}, 'trips/[id]/documents POST') as (req: Request, ctx: Params) => Promise<Response>;
