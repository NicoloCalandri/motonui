import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';
import { convertCurrency } from '@/lib/expenses';

const CreateLegSchema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1),
    to_name: z.string().min(1),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
    departure_at: z.string().nullable().optional(),
    arrival_at: z.string().nullable().optional(),
    duration_min: z.number().nullable().optional(),
    cost: z.number().nullable().optional(),
    currency: z.string().default('EUR'),
    carrier: z.string().nullable().optional(),
    booking_ref: z.string().nullable().optional(),
    pnr: z.string().nullable().optional(),
    checkin_opens_at: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    segments: z.array(z.object({
        from_name: z.string().min(1),
        to_name: z.string().min(1),
        from_lat: z.number().nullable().optional(),
        from_lng: z.number().nullable().optional(),
        to_lat: z.number().nullable().optional(),
        to_lng: z.number().nullable().optional(),
    })).optional(),
});

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = CreateLegSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const data = parsed.data;

    // Support multi-segment flights
    if (data.type === 'flight' && data.segments && data.segments.length > 0) {
        const rows = data.segments.map((seg, idx) => ({
            trip_id: id,
            type: 'flight' as const,
            from_name: seg.from_name,
            to_name: seg.to_name,
            from_lat: seg.from_lat,
            from_lng: seg.from_lng,
            to_lat: seg.to_lat,
            to_lng: seg.to_lng,
            departure_at: idx === 0 ? data.departure_at : null,
            arrival_at: idx === data.segments!.length - 1 ? data.arrival_at : null,
            cost: idx === 0 ? data.cost : null,
            currency: data.currency,
            pnr: data.pnr,
            carrier: data.carrier,
            sort_order: idx,
        }));

        const { data: insertedRows, error } = await supabase.from('legs').insert(rows).select();
        if (error) throw new Error(`[motonui][legs][POST multi] ${error.message}`);
        
        // Auto-create expense for the first segment if cost is provided
        if (data.cost && data.cost > 0 && insertedRows && insertedRows.length > 0) {
            const amount_eur = await convertCurrency(data.cost, data.currency, 'EUR');
            await supabase.from('expenses').insert({
                trip_id: id,
                description: `Volo: ${data.segments![0].from_name} → ${data.segments![data.segments!.length - 1].to_name}`,
                amount: data.cost,
                currency: data.currency,
                amount_eur,
                category: 'transport',
                paid_by: user.id,
                split: true,
                date: data.departure_at ? data.departure_at.slice(0, 10) : null,
            });
        }

        return ok({ success: true });
    }

    // Single leg
    const { error } = await supabase.from('legs').insert({
        trip_id: id,
        type: data.type,
        from_name: data.from_name,
        to_name: data.to_name,
        from_lat: data.from_lat,
        from_lng: data.from_lng,
        to_lat: data.to_lat,
        to_lng: data.to_lng,
        departure_at: data.departure_at,
        arrival_at: data.arrival_at,
        duration_min: data.duration_min,
        cost: data.cost,
        currency: data.currency,
        carrier: data.carrier,
        booking_ref: data.booking_ref,
        pnr: data.pnr,
        checkin_opens_at: data.checkin_opens_at,
        notes: data.notes,
        sort_order: 0,
    });

    if (error) throw new Error(`[motonui][legs][POST] ${error.message}`);

    // Auto-create expense if cost provided
    if (data.cost && data.cost > 0) {
        const amount_eur = await convertCurrency(data.cost, data.currency, 'EUR');
        await supabase.from('expenses').insert({
            trip_id: id,
            description: `Spostamento: ${data.from_name} → ${data.to_name}`,
            amount: data.cost,
            currency: data.currency,
            amount_eur,
            category: 'transport',
            paid_by: user.id,
            split: true,
            date: data.departure_at ? data.departure_at.slice(0, 10) : null,
        });
    }

    return ok({ success: true });
}, 'trips/[id]/legs POST') as (req: Request, ctx: Params) => Promise<Response>;

export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;

    await requireTripMember(supabase, id, user.id);

    const { data: legs, error } = await supabase
        .from('legs')
        .select('*')
        .eq('trip_id', id)
        .order('departure_at', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`[motonui][legs][GET] ${error.message}`);

    return ok(legs || []);
}, 'trips/[id]/legs GET') as (req: Request, ctx: Params) => Promise<Response>;
