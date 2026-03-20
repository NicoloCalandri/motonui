import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { uploadFile, Buckets } from '@/lib/storage';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

type Params = { params: Promise<{ id: string; dayId: string; legId: string }> };

/**
 * POST /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass
 * Uploads a boarding pass image or PDF and updates the leg record.
 */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId, legId } = await params;

    // Verify leg belongs to this trip/day
    const { data: leg } = await supabase
        .from('legs')
        .select('id')
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', id)
        .single();
    if (!leg) throw Errors.notFound('Spostamento');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw Errors.validation('Campo "file" mancante.');

    if (!ALLOWED.has(file.type)) {
        throw Errors.validation('Formato non supportato. Carica JPEG, PNG, WebP, HEIC o PDF.');
    }
    if (file.size > MAX_SIZE) {
        throw Errors.validation(`File troppo grande (max 20 MB).`);
    }

    const ext = file.type === 'application/pdf' ? 'pdf' : file.name.split('.').pop() ?? 'jpg';
    const storagePath = `trips/${id}/boarding-passes/${legId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadFile(Buckets.tripMedia, storagePath, buffer, file.type);

    // Update leg with boarding pass URL
    const { data: updated, error } = await supabase
        .from('legs')
        .update({ boarding_pass_url: publicUrl })
        .eq('id', legId)
        .select()
        .single();

    if (error) throw new Error(`[motonui][boarding-pass][POST] ${error.message}`);

    return ok(updated);
}, 'trips/[id]/days/[dayId]/legs/[legId]/boarding-pass POST') as (req: Request, ctx: Params) => Promise<Response>;

/**
 * DELETE /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass
 * Removes the boarding pass URL from the leg (does not delete from storage).
 */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId, legId } = await params;

    const { error } = await supabase
        .from('legs')
        .update({ boarding_pass_url: null })
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][boarding-pass][DELETE] ${error.message}`);

    return ok({ success: true });
}, 'trips/[id]/days/[dayId]/legs/[legId]/boarding-pass DELETE') as (req: Request, ctx: Params) => Promise<Response>;
