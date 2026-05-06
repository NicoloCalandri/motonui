import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { withErrorHandler, Errors, ok } from '@/lib/errors';
import { requireTripMember } from '@/lib/authz';
import { convertCurrency } from '@/lib/expenses';

const CreateAccommodationSchema = z.object({
    name: z.string().min(1),
    address: z.string().nullable().optional(),
    check_in: z.string().nullable().optional(),
    check_out: z.string().nullable().optional(),
    cost: z.number().nullable().optional(),
    currency: z.string().default('EUR'),
    booking_ref: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandler(async (request, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;

    await requireTripMember(supabase, id, user.id);

    const body = await request.json();
    const parsed = CreateAccommodationSchema.safeParse(body);
    if (!parsed.success) throw Errors.validation(parsed.error.message);

    const data = parsed.data;

    const { error } = await supabase.from('accommodations').insert({
        trip_id: id,
        name: data.name,
        address: data.address,
        check_in: data.check_in,
        check_out: data.check_out,
        cost: data.cost,
        currency: data.currency,
        booking_ref: data.booking_ref,
        notes: data.notes,
        url: data.url,
    });

    if (error) throw new Error(`[motonui][accommodations][POST] ${error.message}`);

    // Auto-create expense if cost provided
    if (data.cost && data.cost > 0) {
        const amount_eur = await convertCurrency(data.cost, data.currency, 'EUR');
        await supabase.from('expenses').insert({
            trip_id: id,
            description: `Alloggio: ${data.name}`,
            amount: data.cost,
            currency: data.currency,
            amount_eur,
            category: 'accommodation',
            paid_by: user.id,
            split: true,
            date: data.check_in ? data.check_in.slice(0, 10) : null,
        });
    }

    return ok({ success: true });
}, 'trips/[id]/accommodations POST') as (req: Request, ctx: Params) => Promise<Response>;

export const GET = withErrorHandler(async (_req, { params }) => {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const { id } = await params;

    await requireTripMember(supabase, id, user.id);

    const { data: accommodations, error } = await supabase
        .from('accommodations')
        .select('*')
        .eq('trip_id', id)
        .order('check_in', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`[motonui][accommodations][GET] ${error.message}`);

    return ok(accommodations || []);
}, 'trips/[id]/accommodations GET') as (req: Request, ctx: Params) => Promise<Response>;
