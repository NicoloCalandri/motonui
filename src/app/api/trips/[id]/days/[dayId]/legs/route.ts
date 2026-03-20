import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, created } from '@/lib/errors';
import { convertCurrency } from '@/lib/expenses';
import { upsertFlightCheckinReminder } from '@/lib/reminders';

const FlightSegmentSchema = z.object({
    from_name: z.string().min(1).max(200),
    to_name: z.string().min(1).max(200),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
});

const CreateLegSchema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1).max(200),
    to_name: z.string().min(1).max(200),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
    departure_at: z.string().optional().nullable().transform((v) => v || null),
    arrival_at: z.string().optional().nullable().transform((v) => v || null),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    carrier: z.string().max(200).optional().nullable(),
    booking_ref: z.string().max(100).optional().nullable(),
    pnr: z.string().max(20).optional().nullable(),
    checkin_opens_at: z.string().optional().nullable().transform((v) => v || null),
    /** Multi-segment flights only — when present, creates one leg per segment + single shared expense */
    segments: z.array(FlightSegmentSchema).min(2).max(6).optional(),
});

type Params = { params: Promise<{ id: string; dayId: string }> };

export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();

    const user = await getAuthUser(supabase);

    const { id, dayId } = await params;
    const body: unknown = await request.json();
    const parsed = CreateLegSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const input = parsed.data;

    // ── Multi-segment flight ──────────────────────────────────────────────────
    if (input.type === 'flight' && input.segments && input.segments.length >= 2) {
        const segs = input.segments;

        // Insert one leg row per segment
        const legsToInsert = segs.map((seg, idx) => ({
            type: 'flight' as const,
            from_name: seg.from_name,
            to_name: seg.to_name,
            from_lat: seg.from_lat ?? null,
            from_lng: seg.from_lng ?? null,
            to_lat: seg.to_lat ?? null,
            to_lng: seg.to_lng ?? null,
            trip_id: id,
            day_id: dayId,
            carrier: input.carrier ?? null,
            booking_ref: input.booking_ref ?? null,
            pnr: input.pnr ?? null,
            checkin_opens_at: input.checkin_opens_at ?? null,
            // Only first leg gets departure; only last gets arrival
            departure_at: idx === 0 ? (input.departure_at ?? null) : null,
            arrival_at: idx === segs.length - 1 ? (input.arrival_at ?? null) : null,
            cost: null, // individual legs have no cost — expense is shared
            currency: input.currency,
            sort_order: idx,
        }));

        const { data: legs, error: legsError } = await supabase
            .from('legs')
            .insert(legsToInsert)
            .select();

        if (legsError) throw new Error(`[motonui][legs][POST] ${legsError.message}`);

        // Single shared expense for the whole multi-leg journey
        if (input.cost && input.cost > 0) {
            const amount_eur = await convertCurrency(input.cost, input.currency, 'EUR');
            const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();
            const routeLabel = `${segs[0].from_name.split(' — ')[0]} → ${segs[segs.length - 1].to_name.split(' — ')[0]}`;

            await supabase.from('expenses').insert({
                trip_id: id,
                day_id: dayId,
                description: `Volo: ${routeLabel}`,
                amount: input.cost,
                currency: input.currency,
                amount_eur,
                category: 'transport',
                paid_by: user.id,
                split: true,
                date: day?.date ?? null,
            });
        }

        // Check-in reminder for the first leg
        if (input.checkin_opens_at && legs && legs[0]) {
            await upsertFlightCheckinReminder(supabase, {
                tripId: id,
                userId: user.id,
                legId: legs[0].id,
                from: segs[0].from_name,
                to: segs[segs.length - 1].to_name,
                checkinOpensAt: input.checkin_opens_at,
                carrier: input.carrier ?? null,
            });
        }

        return created({ legs });
    }

    // ── Single leg ────────────────────────────────────────────────────────────
    const { data: leg, error } = await supabase
        .from('legs')
        .insert({
            type: input.type,
            from_name: input.from_name,
            to_name: input.to_name,
            trip_id: id,
            day_id: dayId,
            from_lat: input.from_lat ?? null,
            from_lng: input.from_lng ?? null,
            to_lat: input.to_lat ?? null,
            to_lng: input.to_lng ?? null,
            departure_at: input.departure_at ?? null,
            arrival_at: input.arrival_at ?? null,
            cost: input.cost ?? null,
            currency: input.currency,
            carrier: input.carrier ?? null,
            booking_ref: input.booking_ref ?? null,
            pnr: input.pnr ?? null,
            checkin_opens_at: input.checkin_opens_at ?? null,
        })
        .select()
        .single();

    if (error) throw new Error(`[motonui][legs][POST] ${error.message}`);

    // Auto-create transport expense
    if (input.cost && input.cost > 0) {
        const amount_eur = await convertCurrency(input.cost, input.currency, 'EUR');
        const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();

        await supabase.from('expenses').insert({
            trip_id: id,
            day_id: dayId,
            description: `Spostamento: ${input.from_name} → ${input.to_name}`,
            amount: input.cost,
            currency: input.currency,
            amount_eur,
            category: 'transport',
            paid_by: user.id,
            split: true,
            date: day?.date ?? null,
        });
    }

    if (input.type === 'flight' && input.checkin_opens_at) {
        await upsertFlightCheckinReminder(supabase, {
            tripId: id,
            userId: user.id,
            legId: leg.id,
            from: leg.from_name ?? '',
            to: leg.to_name ?? '',
            checkinOpensAt: input.checkin_opens_at,
            carrier: leg.carrier ?? null,
        });
    }

    return created(leg);
}, 'trips/[id]/days/[dayId]/legs POST') as (req: Request, ctx: Params) => Promise<Response>;
