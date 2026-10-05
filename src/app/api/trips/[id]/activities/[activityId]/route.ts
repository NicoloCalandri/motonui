import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { Errors, ok } from '@/lib/errors';
import { upsertActivityReminder } from '@/lib/reminders';

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

/** PUT /api/trips/[id]/activities/[activityId] */
export const PUT = withRoute(
    { name: 'trips/[id]/activities/[activityId] PUT', params: tripParams('activityId'), body: UpdateActivitySchema, tripMember: true },
    async ({ supabase, user, params, body }) => {
    const { id, activityId } = params;
    const { data: activity, error } = await supabase
        .from('activities')
        .update(body)
        .eq('id', activityId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Attività');

    // Update reminder
    const date = body.date ?? activity.date;
    const time = body.time ?? activity.time;
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

    return ok(activity);
});

/** DELETE /api/trips/[id]/activities/[activityId] */
export const DELETE = withRoute(
    { name: 'trips/[id]/activities/[activityId] DELETE', params: tripParams('activityId'), tripMember: true },
    async ({ supabase, params }) => {
    const { id, activityId } = params;
    const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)
        .eq('trip_id', id);

    if (error) throw Errors.notFound('Attività');

    // Clean up reminders
    await supabase
        .from('reminders')
        .delete()
        .eq('entity_id', activityId)
        .eq('entity_type', 'activity');

    return ok({ success: true });
});
