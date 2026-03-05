import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok, created } from '@/lib/errors';

const CreateDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

/** GET /api/trips/[id]/days — list days with legs + accommodations */
export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;

    const { data, error } = await supabase
        .from('days')
        .select(`*, legs(*), accommodations(*)`)
        .eq('trip_id', id)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][days][GET] ${error.message}`);

    return ok(data ?? []);
}, 'trips/[id]/days GET') as (req: Request, ctx: Params) => Promise<Response>;

/** POST /api/trips/[id]/days — add a day */
export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = CreateDaySchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: day, error } = await supabase
        .from('days')
        .insert({ ...parsed.data, trip_id: id })
        .select()
        .single();

    if (error) throw new Error(`[motonui][days][POST] ${error.message}`);

    return created(day);
}, 'trips/[id]/days POST') as (req: Request, ctx: Params) => Promise<Response>;
