import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { Buckets, deleteFile, downloadFile, uploadPrivateFile, validateFile } from '@/lib/storage';
import { requireTripMember } from '@/lib/authz';
import {
    boardingPassExtension,
    boardingPassMimeType,
    buildBoardingPassPath,
    isBoardingPassPathForTrip,
    legacyBoardingPassPath,
} from '@/lib/boarding-pass';

type Params = { params: Promise<{ id: string; dayId: string; legId: string }> };

/** Matches file_size_limit of the trip-documents bucket (migration 0017). */
const MAX_BOARDING_PASS_BYTES = 20 * 1024 * 1024;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface LegFiles {
    id: string;
    boarding_pass_path: string | null;
    boarding_pass_url: string | null;
}

/** Loads the leg only if it belongs to the trip and day in the URL. */
async function getLeg(supabase: SupabaseServerClient, tripId: string, dayId: string, legId: string): Promise<LegFiles> {
    const { data: leg } = await supabase
        .from('legs')
        .select('id, boarding_pass_path, boarding_pass_url')
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', tripId)
        .single();
    if (!leg) throw Errors.notFound('Spostamento');
    return leg as LegFiles;
}

/**
 * Deletes the stored files of a leg. Paths are re-checked against the trip
 * prefix: the columns are writable by trip members, so an unchecked value
 * could point the service role at another trip's files.
 */
async function removeStoredFiles(tripId: string, leg: LegFiles): Promise<void> {
    if (isBoardingPassPathForTrip(leg.boarding_pass_path, tripId)) {
        await deleteFile(Buckets.tripDocuments, leg.boarding_pass_path);
    }
    const legacyPath = legacyBoardingPassPath(leg.boarding_pass_url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (isBoardingPassPathForTrip(legacyPath, tripId)) {
        await deleteFile(Buckets.tripMedia, legacyPath);
    }
}

/**
 * GET /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass[?download=1]
 * Streams the boarding pass from the private bucket after an auth and
 * membership check. No storage URL ever reaches the browser.
 */
export const GET = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const { id, dayId, legId } = await params;
    await requireTripMember(supabase, id, user.id);

    const leg = await getLeg(supabase, id, dayId, legId);
    if (!isBoardingPassPathForTrip(leg.boarding_pass_path, id)) {
        throw Errors.notFound("Carta d'imbarco");
    }

    const file = await downloadFile(Buckets.tripDocuments, leg.boarding_pass_path);
    if (!file) throw Errors.notFound("Carta d'imbarco");

    const contentType = boardingPassMimeType(leg.boarding_pass_path);
    const extension = leg.boarding_pass_path.split('.').pop();
    const download = new URL(request.url).searchParams.get('download') === '1';

    return new Response(file.stream(), {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="carta-imbarco.${extension}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}, 'trips/[id]/days/[dayId]/legs/[legId]/boarding-pass GET') as (req: Request, ctx: Params) => Promise<Response>;

/**
 * POST /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass
 * Uploads a boarding pass image or PDF to the private bucket and replaces any
 * previous file.
 */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const { id, dayId, legId } = await params;
    await requireTripMember(supabase, id, user.id);

    const previous = await getLeg(supabase, id, dayId, legId);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) throw Errors.validation('Campo "file" mancante.');

    const extension = boardingPassExtension(file.type);
    if (!extension) throw Errors.validation('Carica un\'immagine (JPEG, PNG, WebP, HEIC) o un PDF.');

    if (file.size > MAX_BOARDING_PASS_BYTES) throw Errors.validation('Il file supera i 20 MB.');

    const buffer = Buffer.from(await file.arrayBuffer());
    validateFile(file.type, file.size, buffer);

    const storagePath = buildBoardingPassPath(id, legId, extension);
    await uploadPrivateFile(Buckets.tripDocuments, storagePath, buffer, file.type);

    const { data: updated, error } = await supabase
        .from('legs')
        .update({ boarding_pass_path: storagePath, boarding_pass_url: null })
        .eq('id', legId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) {
        await deleteFile(Buckets.tripDocuments, storagePath);
        throw new Error(`[motonui][boarding-pass][POST] ${error.message}`);
    }

    await removeStoredFiles(id, previous);

    return ok(updated);
}, 'trips/[id]/days/[dayId]/legs/[legId]/boarding-pass POST') as (req: Request, ctx: Params) => Promise<Response>;

/**
 * DELETE /api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass
 * Removes the boarding pass from the leg and deletes the file from storage.
 */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    const { id, dayId, legId } = await params;
    await requireTripMember(supabase, id, user.id);

    const leg = await getLeg(supabase, id, dayId, legId);

    const { error } = await supabase
        .from('legs')
        .update({ boarding_pass_path: null, boarding_pass_url: null })
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][boarding-pass][DELETE] ${error.message}`);

    await removeStoredFiles(id, leg);

    return ok({ success: true });
}, 'trips/[id]/days/[dayId]/legs/[legId]/boarding-pass DELETE') as (req: Request, ctx: Params) => Promise<Response>;
