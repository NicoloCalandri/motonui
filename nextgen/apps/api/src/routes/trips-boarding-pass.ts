import { Hono } from 'hono';
import type { Context } from 'hono';
import { withErrorHandler, ok, requireParam, readFormData } from '../lib/http';
import { Errors } from '../lib/errors';
import { boardingPassExtension, boardingPassMimeType, buildBoardingPassPath, isBoardingPassPathForTrip } from '../lib/boarding-pass';
import { Buckets, deleteFile, downloadFile, uploadPrivateFile, validateFile } from '../lib/storage';
import { removeLegFiles } from '../lib/trip-storage';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/days/:dayId/legs, next to tripsDayLegsRouter.
// Membership is checked by tripGuard (app.ts). Port of
// src/app/api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass/route.ts.
export const tripsBoardingPassRouter = new Hono<AppEnv>();

/** Matches file_size_limit of the trip-documents bucket (migration 0017). */
const MAX_BOARDING_PASS_BYTES = 20 * 1024 * 1024;

interface LegFiles {
    id: string;
    boarding_pass_path: string | null;
    boarding_pass_url: string | null;
}

/** Loads the leg only if it belongs to the trip and day in the URL. */
async function getLeg(c: Context<AppEnv>): Promise<LegFiles> {
    const { data: leg } = await c.get('supabase')
        .from('legs')
        .select('id, boarding_pass_path, boarding_pass_url')
        .eq('id', requireParam(c, 'legId'))
        .eq('day_id', requireParam(c, 'dayId'))
        .eq('trip_id', requireParam(c, 'id'))
        .single();
    if (!leg) throw Errors.notFound('Spostamento');
    return leg;
}

/**
 * GET /api/trips/:id/days/:dayId/legs/:legId/boarding-pass[?download=1]
 * Streams the boarding pass from the private bucket after an auth and
 * membership check. No storage URL ever reaches the browser.
 */
tripsBoardingPassRouter.get(
    '/:legId/boarding-pass',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const id = requireParam(c, 'id');
        const leg = await getLeg(c);
        if (!isBoardingPassPathForTrip(leg.boarding_pass_path, id)) throw Errors.notFound("Carta d'imbarco");

        const file = await downloadFile(Buckets.tripDocuments, leg.boarding_pass_path);
        if (!file) throw Errors.notFound("Carta d'imbarco");

        const extension = leg.boarding_pass_path.split('.').pop();
        const download = c.req.query('download') === '1';

        return new Response(file.stream(), {
            status: 200,
            headers: {
                'Content-Type': boardingPassMimeType(leg.boarding_pass_path),
                'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="carta-imbarco.${extension}"`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    }, 'trips/:id/days/:dayId/legs/:legId/boarding-pass GET')
);

/**
 * POST /api/trips/:id/days/:dayId/legs/:legId/boarding-pass
 * Uploads a boarding pass image or PDF to the private bucket and replaces any
 * previous file.
 */
tripsBoardingPassRouter.post(
    '/:legId/boarding-pass',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const id = requireParam(c, 'id');
        const legId = requireParam(c, 'legId');
        const previous = await getLeg(c);

        const formData = await readFormData(c);
        const file = formData.get('file');
        if (!(file instanceof File)) throw Errors.validation('Campo "file" mancante.');

        const extension = boardingPassExtension(file.type);
        if (!extension) throw Errors.validation("Carica un'immagine (JPEG, PNG, WebP, HEIC) o un PDF.");
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

        // Paths are re-checked against the trip prefix: the columns are
        // writable by trip members.
        await removeLegFiles(id, previous);

        return ok(c, updated);
    }, 'trips/:id/days/:dayId/legs/:legId/boarding-pass POST')
);

/**
 * DELETE /api/trips/:id/days/:dayId/legs/:legId/boarding-pass
 * Removes the boarding pass from the leg and deletes the file from storage.
 */
tripsBoardingPassRouter.delete(
    '/:legId/boarding-pass',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const id = requireParam(c, 'id');
        const leg = await getLeg(c);

        const { error } = await c.get('supabase')
            .from('legs')
            .update({ boarding_pass_path: null, boarding_pass_url: null })
            .eq('id', requireParam(c, 'legId'))
            .eq('day_id', requireParam(c, 'dayId'))
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][boarding-pass][DELETE] ${error.message}`);

        await removeLegFiles(id, leg);

        return ok(c, { success: true });
    }, 'trips/:id/days/:dayId/legs/:legId/boarding-pass DELETE')
);
