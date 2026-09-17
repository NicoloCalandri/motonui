import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/days
export const tripsDaysRouter = new Hono<AppEnv>();

const CreateDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    sort_order: z.number().int().optional(),
});

const UpdateDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    title: z.string().max(200).optional().nullable(),
});

/**
 * GET /api/trips/:id/days — list days with legs + accommodations + activities
 * NOTE: ported faithfully from the original — it does NOT call
 * requireTripMember (unlike the sibling /legs routes), relying on RLS alone.
 * Flagged, not "fixed", per the porting brief.
 */
tripsDaysRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const { data, error } = await supabase
            .from('days')
            .select(`*, legs(*), accommodations(*), activities(*)`)
            .eq('trip_id', id)
            .order('date', { ascending: true });

        if (error) throw new Error(`[motonui][days][GET] ${error.message}`);

        return ok(c, data ?? []);
    }, 'trips/:id/days GET')
);

/** POST /api/trips/:id/days — add a day (same no-requireTripMember note as GET above) */
tripsDaysRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        const body: unknown = await c.req.json();
        const parsed = CreateDaySchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: day, error } = await supabase
            .from('days')
            .insert({ ...parsed.data, trip_id: id })
            .select()
            .single();

        if (error) throw new Error(`[motonui][days][POST] ${error.message}`);

        return created(c, day);
    }, 'trips/:id/days POST')
);

/** PUT /api/trips/:id/days/:dayId */
tripsDaysRouter.put(
    '/:dayId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = UpdateDaySchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: day, error } = await supabase
            .from('days')
            .update(parsed.data)
            .eq('id', dayId)
            .eq('trip_id', id)
            .select()
            .single();

        if (error) throw new Error(`[motonui][days][PUT] ${error.message}`);
        if (!day) throw Errors.notFound('Giorno');

        return ok(c, day);
    }, 'trips/:id/days/:dayId PUT')
);

/** DELETE /api/trips/:id/days/:dayId */
tripsDaysRouter.delete(
    '/:dayId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');

        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('days')
            .delete()
            .eq('id', dayId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][days][DELETE] ${error.message}`);

        return ok(c, { success: true });
    }, 'trips/:id/days/:dayId DELETE')
);
