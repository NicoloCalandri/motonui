import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { convertCurrency } from '../lib/expenses';
import { upsertActivityReminder } from '../lib/reminders';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/activities
export const tripsActivitiesRouter = new Hono<AppEnv>();

const CreateActivitySchema = z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['museum', 'tour', 'excursion', 'show', 'sport', 'other']).default('tour'),
    address: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    duration_min: z.coerce.number().int().min(1).optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    booking_ref: z.string().max(100).optional().nullable(),
    ticket_url: z.string().url().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    day_id: z.string().uuid().optional().nullable(),
});

const UpdateActivitySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['museum', 'tour', 'excursion', 'show', 'sport', 'other']).optional(),
    address: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    duration_min: z.coerce.number().int().min(1).optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).optional(),
    booking_ref: z.string().max(100).optional().nullable(),
    ticket_url: z.string().url().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    day_id: z.string().uuid().optional().nullable(),
});

/** GET /api/trips/:id/activities — list all activities for a trip */
tripsActivitiesRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('trip_id', id)
            .order('date', { ascending: true });

        if (error) throw new Error(`[motonui][activities][GET] ${error.message}`);
        return ok(c, data ?? []);
    }, 'trips/:id/activities GET')
);

/** POST /api/trips/:id/activities — create an activity */
tripsActivitiesRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
        const parsed = CreateActivitySchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: activity, error } = await supabase
            .from('activities')
            .insert({ ...parsed.data, trip_id: id })
            .select()
            .single();

        if (error) throw new Error(`[motonui][activities][POST] ${error.message}`);

        if (parsed.data.cost && parsed.data.cost > 0) {
            const amount_eur = await convertCurrency(parsed.data.cost, parsed.data.currency, 'EUR');
            await supabase.from('expenses').insert({
                trip_id: id,
                day_id: parsed.data.day_id ?? null,
                description: `Attività: ${parsed.data.name}`,
                amount: parsed.data.cost,
                currency: parsed.data.currency,
                amount_eur,
                category: 'activity',
                paid_by: user.id,
                split: true,
                date: parsed.data.date ?? null,
            });
        }

        if (parsed.data.date && parsed.data.time) {
            await upsertActivityReminder(supabase, {
                userId: user.id,
                tripId: id,
                activityId: activity.id,
                name: parsed.data.name,
                date: parsed.data.date,
                time: parsed.data.time,
            });
        }

        return created(c, activity);
    }, 'trips/:id/activities POST')
);

/** PUT /api/trips/:id/activities/:activityId */
tripsActivitiesRouter.put(
    '/:activityId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const activityId = requireParam(c, 'activityId');
        await requireTripMember(supabase, id, user.id);

        const body: unknown = await c.req.json();
        const parsed = UpdateActivitySchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: activity, error } = await supabase
            .from('activities')
            .update(parsed.data)
            .eq('id', activityId)
            .eq('trip_id', id)
            .select()
            .single();

        if (error) throw Errors.notFound('Attività');

        const date = parsed.data.date ?? activity.date;
        const time = parsed.data.time ?? activity.time;
        if (date && time) {
            await upsertActivityReminder(supabase, {
                userId: user.id,
                tripId: id,
                activityId: activity.id,
                name: activity.name,
                date,
                time,
            });
        }

        return ok(c, activity);
    }, 'trips/:id/activities/:activityId PUT')
);

/** DELETE /api/trips/:id/activities/:activityId */
tripsActivitiesRouter.delete(
    '/:activityId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const activityId = requireParam(c, 'activityId');
        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('id', activityId)
            .eq('trip_id', id);

        if (error) throw Errors.notFound('Attività');

        await (supabase as any)
            .from('reminders')
            .delete()
            .eq('entity_id', activityId)
            .eq('entity_type', 'activity');

        return ok(c, { success: true });
    }, 'trips/:id/activities/:activityId DELETE')
);
