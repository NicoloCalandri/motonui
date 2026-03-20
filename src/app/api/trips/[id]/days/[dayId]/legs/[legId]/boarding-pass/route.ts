import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { uploadFile, Buckets, validateFile } from '@/lib/storage';
import { requireTripMember } from '@/lib/authz';

type Params = { params: Promise<{ id: string; dayId: string; legId: string }> };

/**
 * POST /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass
 * Uploads a boarding pass image or PDF and updates the leg record.
 */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, dayId, legId } = await params;
    await requireTripMember(supabase, id, user.id);

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

    const ext = file.type === 'application/pdf' ? 'pdf' : file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
    const storagePath = `trips/${id}/boarding-passes/${legId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    validateFile(file.type, file.size, buffer);
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

    const user = await getAuthUser(supabase);

    const { id, dayId, legId } = await params;
    await requireTripMember(supabase, id, user.id);

    const { error } = await supabase
        .from('legs')
        .update({ boarding_pass_url: null })
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][boarding-pass][DELETE] ${error.message}`);

    return ok({ success: true });
}, 'trips/[id]/days/[dayId]/legs/[legId]/boarding-pass DELETE') as (req: Request, ctx: Params) => Promise<Response>;
