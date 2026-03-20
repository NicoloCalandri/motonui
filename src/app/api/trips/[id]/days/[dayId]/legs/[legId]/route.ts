import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertFlightCheckinReminder } from '@/lib/reminders';

type Params = { params: Promise<{ id: string; dayId: string; legId: string }> };

const UpdateLegSchema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']).optional(),
    from_name: z.string().min(1).max(200).optional(),
    to_name: z.string().min(1).max(200).optional(),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
    departure_at: z.string().nullable().optional().transform((v) => v || null),
    arrival_at: z.string().nullable().optional().transform((v) => v || null),
    cost: z.number().nullable().optional(),
    currency: z.string().optional(),
    notes: z.string().nullable().optional(),
    carrier: z.string().max(200).nullable().optional(),
    booking_ref: z.string().max(100).nullable().optional(),
    pnr: z.string().max(20).nullable().optional(),
    checkin_opens_at: z.string().nullable().optional().transform((v) => v || null),
});

export const PUT = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId, legId } = await params;
    const body: unknown = await request.json();
    const parsed = UpdateLegSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const { data: leg, error } = await supabase
        .from('legs')
        .update(parsed.data)
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', id)
        .select()
        .single();

    if (error) throw Errors.notFound('Spostamento');

    // Sync the related expense if cost/currency changed
    const expDesc = `Spostamento: ${leg.from_name} → ${leg.to_name}`;
    if (leg.cost && leg.cost > 0) {
        const amount_eur = await convertCurrency(leg.cost, leg.currency, 'EUR');
        const { data: existing } = await supabase
            .from('expenses')
            .select('id')
            .eq('trip_id', id)
            .eq('day_id', dayId)
            .like('description', `Spostamento:%`)
            .single();
        if (existing) {
            await supabase
                .from('expenses')
                .update({ description: expDesc, amount: leg.cost, currency: leg.currency, amount_eur, category: 'transport' })
                .eq('id', existing.id);
        } else {
            const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();
            await supabase.from('expenses').insert({
                trip_id: id,
                day_id: dayId,
                description: expDesc,
                amount: leg.cost,
                currency: leg.currency,
                amount_eur,
                category: 'transport',
                paid_by: (await supabase.auth.getUser()).data.user!.id,
                split: true,
                date: day?.date ?? null,
            });
        }
    } else {
        // Cost removed — delete any linked expense
        await supabase
            .from('expenses')
            .delete()
            .eq('trip_id', id)
            .eq('day_id', dayId)
            .like('description', `Spostamento:%`);
    }

    // Keep flight check-in reminder in sync
    if (leg.type === 'flight' && leg.checkin_opens_at) {
        await upsertFlightCheckinReminder(supabase, {
            tripId: id,
            userId: user.id,
            legId: leg.id,
            from: leg.from_name ?? '',
            to: leg.to_name ?? '',
            carrier: leg.carrier ?? null,
            checkinOpensAt: leg.checkin_opens_at,
        });
    }

    return ok(leg);
}, 'trips/[id]/days/[dayId]/legs/[legId] PUT') as (req: Request, ctx: Params) => Promise<Response>;

export const DELETE = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { id, dayId, legId } = await params;

    // Delete linked expense first (if any)
    await supabase
        .from('expenses')
        .delete()
        .eq('trip_id', id)
        .eq('day_id', dayId)
        .like('description', 'Spostamento:%');

    const { error } = await supabase
        .from('legs')
        .delete()
        .eq('id', legId)
        .eq('day_id', dayId)
        .eq('trip_id', id);

    if (error) throw new Error(`[motonui][legs][DELETE] ${error.message}`);

    return ok({ success: true });
}, 'trips/[id]/days/[dayId]/legs/[legId] DELETE') as (req: Request, ctx: Params) => Promise<Response>;
