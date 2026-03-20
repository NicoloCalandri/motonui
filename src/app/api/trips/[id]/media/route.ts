import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';
import { validateFile, uploadFile, Buckets } from '@/lib/storage';
import { requireTripMember, requireDayInTrip } from '@/lib/authz';
import { sanitizePlainText } from '@/lib/sanitize';

type Params = { params: Promise<{ id: string }> };

const FilterSchema = z.object({
    day_id: z.string().uuid().optional(),
});

/** GET /api/trips/[id]/media — list all media for a trip, optionally filtered by day */
export const GET = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id } = await params;
    await requireTripMember(supabase, id, user.id);
    const { searchParams } = new URL(request.url);

    const filter = FilterSchema.safeParse({
        day_id: searchParams.get('day_id') ?? undefined,
    });

    let query = supabase
        .from('media')
        .select('*')
        .eq('trip_id', id)
        .order('taken_at', { ascending: true })
        .order('created_at', { ascending: false });

    if (filter.success && filter.data.day_id) {
        query = query.eq('day_id', filter.data.day_id);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[motonui][media][GET] ${error.message}`);

    return ok(data ?? []);
}, 'trips/[id]/media GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/media — upload photo/video to Supabase Storage */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id } = await params;
    await requireTripMember(supabase, id, user.id);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dayId = formData.get('day_id') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!file) throw Errors.validation('Campo "file" mancante.');

    const buffer = Buffer.from(await file.arrayBuffer());
    validateFile(file.type, file.size, buffer);
    await requireDayInTrip(supabase, id, dayId);

    const fileExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const filename = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `trips/${id}/original/${filename}`;

    const publicUrl = await uploadFile(Buckets.tripMedia, storagePath, buffer, file.type);

    // Insert media record
    const { data: media, error } = await supabase
        .from('media')
        .insert({
            trip_id: id,
            day_id: dayId ?? null,
            uploaded_by: user.id,
            url: publicUrl,
            size: file.size,
            mime_type: file.type,
            caption: caption ? sanitizePlainText(caption, 500) : null,
            tags: [],
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][media][POST] ${error.message}`);

    return created(media);
}, 'trips/[id]/media POST') as (req: Request, ctx: Params) => Promise<Response>;
