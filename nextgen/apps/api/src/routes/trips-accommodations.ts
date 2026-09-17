import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { convertCurrency } from '../lib/expenses';
import { upsertAccommodationReminders } from '../lib/reminders';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// ─── Day-nested accommodations: mounted at /api/trips/:id/days/:dayId/accommodations ───
// NOTE: ported as-is — no requireTripMember here (unlike the top-level
// variant below), same discrepancy pattern as trips-days.ts.
export const tripsDayAccommodationsRouter = new Hono<AppEnv>();

const CreateDayAccommodationSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().optional().nullable(),
    check_in: z.string().optional().nullable(),
    check_out: z.string().optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().length(3).default('EUR'),
    booking_ref: z.string().max(100).optional().nullable(),
    payment_deadline: z.string().optional().nullable(),
    cancellation_deadline: z.string().optional().nullable(),
});

const UpdateDayAccommodationSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().nullable().optional(),
    check_in: z.string().nullable().optional(),
    check_out: z.string().nullable().optional(),
    cost: z.number().nullable().optional(),
    currency: z.string().optional(),
    notes: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    booking_ref: z.string().max(100).nullable().optional(),
    payment_deadline: z.string().nullable().optional(),
    cancellation_deadline: z.string().nullable().optional(),
});

/** POST /api/trips/:id/days/:dayId/accommodations */
tripsDayAccommodationsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');

        const body: unknown = await c.req.json();
        const parsed = CreateDayAccommodationSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: acc, error } = await supabase
            .from('accommodations')
            .insert({
                ...parsed.data,
                trip_id: id,
                day_id: dayId,
            })
            .select()
            .single();

        if (error) throw new Error(`[motonui][accommodations][POST] ${error.message}`);

        if (parsed.data.cost && parsed.data.cost > 0) {
            const amount_eur = await convertCurrency(parsed.data.cost, parsed.data.currency, 'EUR');
            const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();

            await supabase.from('expenses').insert({
                trip_id: id,
                day_id: dayId,
                description: `Alloggio: ${parsed.data.name}`,
                amount: parsed.data.cost,
                currency: parsed.data.currency,
                amount_eur,
                category: 'accommodation',
                paid_by: user.id,
                split: true,
                date: day?.date ?? null,
            });
        }

        if (parsed.data.payment_deadline || parsed.data.cancellation_deadline) {
            await upsertAccommodationReminders(supabase, {
                tripId: id,
                userId: user.id,
                accId: acc.id,
                name: acc.name,
                paymentDeadline: parsed.data.payment_deadline ?? null,
                cancellationDeadline: parsed.data.cancellation_deadline ?? null,
            });
        }

        return created(c, acc);
    }, 'trips/:id/days/:dayId/accommodations POST')
);

/** PUT /api/trips/:id/days/:dayId/accommodations/:accId */
tripsDayAccommodationsRouter.put(
    '/:accId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');
        const accId = requireParam(c, 'accId');

        const body: unknown = await c.req.json();
        const parsed = UpdateDayAccommodationSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: acc, error } = await supabase
            .from('accommodations')
            .update(parsed.data)
            .eq('id', accId)
            .eq('day_id', dayId)
            .eq('trip_id', id)
            .select()
            .single();

        if (error) throw Errors.notFound('Alloggio');

        const expDesc = `Alloggio: ${acc.name}`;
        if (acc.cost && acc.cost > 0) {
            const amount_eur = await convertCurrency(acc.cost, acc.currency, 'EUR');
            const { data: existing } = await supabase
                .from('expenses')
                .select('id')
                .eq('trip_id', id)
                .eq('day_id', dayId)
                .like('description', 'Alloggio:%')
                .single();
            if (existing) {
                await supabase
                    .from('expenses')
                    .update({ description: expDesc, amount: acc.cost, currency: acc.currency, amount_eur, category: 'accommodation' })
                    .eq('id', existing.id);
            } else {
                const { data: day } = await supabase.from('days').select('date').eq('id', dayId).single();
                await supabase.from('expenses').insert({
                    trip_id: id,
                    day_id: dayId,
                    description: expDesc,
                    amount: acc.cost,
                    currency: acc.currency,
                    amount_eur,
                    category: 'accommodation',
                    paid_by: user.id,
                    split: true,
                    date: day?.date ?? null,
                });
            }
        } else {
            await supabase
                .from('expenses')
                .delete()
                .eq('trip_id', id)
                .eq('day_id', dayId)
                .like('description', 'Alloggio:%');
        }

        if (acc.payment_deadline !== undefined || acc.cancellation_deadline !== undefined) {
            await upsertAccommodationReminders(supabase, {
                tripId: id,
                userId: user.id,
                accId: acc.id,
                name: acc.name,
                paymentDeadline: acc.payment_deadline ?? null,
                cancellationDeadline: acc.cancellation_deadline ?? null,
            });
        }

        return ok(c, acc);
    }, 'trips/:id/days/:dayId/accommodations/:accId PUT')
);

/** DELETE /api/trips/:id/days/:dayId/accommodations/:accId */
tripsDayAccommodationsRouter.delete(
    '/:accId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');
        const accId = requireParam(c, 'accId');

        await supabase
            .from('expenses')
            .delete()
            .eq('trip_id', id)
            .eq('day_id', dayId)
            .like('description', 'Alloggio:%');

        const { error } = await supabase
            .from('accommodations')
            .delete()
            .eq('id', accId)
            .eq('day_id', dayId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][accommodations][DELETE] ${error.message}`);

        return ok(c, { success: true });
    }, 'trips/:id/days/:dayId/accommodations/:accId DELETE')
);

// ─── Top-level accommodations: mounted at /api/trips/:id/accommodations ───
export const tripsAccommodationsRouter = new Hono<AppEnv>();

const TopLevelCreateAccommodationSchema = z.object({
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

const TopLevelUpdateAccommodationSchema = z.object({
    name: z.string().min(1),
    address: z.string().nullable().optional(),
    check_in: z.string().nullable().optional(),
    check_out: z.string().nullable().optional(),
    cost: z.coerce.number().nullable().optional(),
    currency: z.string().default('EUR'),
    booking_ref: z.string().nullable().optional(),
    payment_deadline: z.string().nullable().optional(),
    cancellation_deadline: z.string().nullable().optional(),
});

/** POST /api/trips/:id/accommodations */
tripsAccommodationsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = TopLevelCreateAccommodationSchema.safeParse(body);
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

        return ok(c, { success: true });
    }, 'trips/:id/accommodations POST')
);

/** GET /api/trips/:id/accommodations */
tripsAccommodationsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const { data: accommodations, error } = await supabase
            .from('accommodations')
            .select('*')
            .eq('trip_id', id)
            .order('check_in', { ascending: true, nullsFirst: false });

        if (error) throw new Error(`[motonui][accommodations][GET] ${error.message}`);

        return ok(c, accommodations || []);
    }, 'trips/:id/accommodations GET')
);

/** PUT /api/trips/:id/accommodations/:accId */
tripsAccommodationsRouter.put(
    '/:accId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const accId = requireParam(c, 'accId');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = TopLevelUpdateAccommodationSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { error } = await supabase
            .from('accommodations')
            .update(parsed.data)
            .eq('id', accId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][accommodations][PUT] ${error.message}`);
        return ok(c, { success: true });
    }, 'trips/:id/accommodations/:accId PUT')
);

/** DELETE /api/trips/:id/accommodations/:accId */
tripsAccommodationsRouter.delete(
    '/:accId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const accId = requireParam(c, 'accId');

        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('accommodations')
            .delete()
            .eq('id', accId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][accommodations][DELETE] ${error.message}`);
        return ok(c, { success: true });
    }, 'trips/:id/accommodations/:accId DELETE')
);
