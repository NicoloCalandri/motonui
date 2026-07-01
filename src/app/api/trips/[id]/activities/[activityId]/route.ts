import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';
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

type Params = { params: Promise<{ id: string; activityId: string }> };

/** PUT /api/trips/[id]/activities/[activityId] */
export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, activityId } = await params;
    await requireTripMember(supabase, id, user.id);

    const body: unknown = await request.json();
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

    // Update reminder
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

    return ok(activity);
}, 'trips/[id]/activities/[activityId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

/** DELETE /api/trips/[id]/activities/[activityId] */
export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id, activityId } = await params;
    await requireTripMember(supabase, id, user.id);

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
}, 'trips/[id]/activities/[activityId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
