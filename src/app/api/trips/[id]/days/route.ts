import { z } from 'zod';
import { ok, created } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';

const CreateDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    sort_order: z.number().int().optional(),
});

/** GET /api/trips/[id]/days — list days with legs + accommodations + activities */
export const GET = withRoute(
    { name: 'trips/[id]/days GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;

    const { data, error } = await supabase
        .from('days')
        .select(`*, legs(*), accommodations(*), activities(*)`)
        .eq('trip_id', id)
        .order('date', { ascending: true });

    if (error) throw new Error(`[motonui][days][GET] ${error.message}`);

    return ok(data ?? []);
});

/** POST /api/trips/[id]/days — add a day */
export const POST = withRoute(
    { name: 'trips/[id]/days POST', params: tripParams(), body: CreateDaySchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id } = params;

    const { data: day, error } = await supabase
        .from('days')
        .insert({ ...body, trip_id: id })
        .select()
        .single();

    if (error) throw new Error(`[motonui][days][POST] ${error.message}`);

    return created(day);
});
