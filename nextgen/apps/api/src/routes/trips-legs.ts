import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, created, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { convertCurrency } from '../lib/expenses';
import { upsertFlightCheckinReminder } from '../lib/reminders';
import { uploadFile, Buckets, validateFile } from '../lib/storage';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// ─── Top-level legs: mounted at /api/trips/:id/legs ────────────────────────
// NOTE: this is a genuinely separate, older/simpler route tree from the
// day-nested one below — both exist in the original app and are ported
// faithfully rather than merged. Its POST schema differs slightly from the
// day-nested one (e.g. has `duration_min`, lacks the departure/arrival
// per-segment null-transform quirks) — preserved as-is.
export const tripsLegsRouter = new Hono<AppEnv>();

const TopLevelCreateLegSchema = z.object({
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

const TopLevelUpdateLegSchema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1),
    to_name: z.string().min(1),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
    departure_at: z.string().nullable().optional(),
    arrival_at: z.string().nullable().optional(),
    cost: z.coerce.number().nullable().optional(),
    currency: z.string().default('EUR'),
    carrier: z.string().nullable().optional(),
    booking_ref: z.string().nullable().optional(),
    pnr: z.string().nullable().optional(),
    checkin_opens_at: z.string().nullable().optional(),
});

/** POST /api/trips/:id/legs */
tripsLegsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = TopLevelCreateLegSchema.safeParse(body);
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

            return ok(c, { success: true });
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

        return ok(c, { success: true });
    }, 'trips/:id/legs POST')
);

/** GET /api/trips/:id/legs */
tripsLegsRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const { data: legs, error } = await supabase
            .from('legs')
            .select('*')
            .eq('trip_id', id)
            .order('departure_at', { ascending: true, nullsFirst: false });

        if (error) throw new Error(`[motonui][legs][GET] ${error.message}`);

        return ok(c, legs || []);
    }, 'trips/:id/legs GET')
);

/** PUT /api/trips/:id/legs/:legId */
tripsLegsRouter.put(
    '/:legId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const legId = requireParam(c, 'legId');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = TopLevelUpdateLegSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { error } = await supabase
            .from('legs')
            .update(parsed.data)
            .eq('id', legId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][legs][PUT] ${error.message}`);
        return ok(c, { success: true });
    }, 'trips/:id/legs/:legId PUT')
);

/** DELETE /api/trips/:id/legs/:legId */
tripsLegsRouter.delete(
    '/:legId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const legId = requireParam(c, 'legId');

        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('legs')
            .delete()
            .eq('id', legId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][legs][DELETE] ${error.message}`);
        return ok(c, { success: true });
    }, 'trips/:id/legs/:legId DELETE')
);

// ─── Day-nested legs: mounted at /api/trips/:id/days/:dayId/legs ──────────
export const tripsDayLegsRouter = new Hono<AppEnv>();

const FlightSegmentSchema = z.object({
    from_name: z.string().min(1).max(200),
    to_name: z.string().min(1).max(200),
    from_lat: z.number().nullable().optional(),
    from_lng: z.number().nullable().optional(),
    to_lat: z.number().nullable().optional(),
    to_lng: z.number().nullable().optional(),
});

const CreateDayLegSchema = z.object({
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

const UpdateDayLegSchema = z.object({
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

/** POST /api/trips/:id/days/:dayId/legs (no requireTripMember, ported as-is) */
tripsDayLegsRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');

        const body: unknown = await c.req.json();
        const parsed = CreateDayLegSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const input = parsed.data;

        // ── Multi-segment flight ──────────────────────────────────────────
        if (input.type === 'flight' && input.segments && input.segments.length >= 2) {
            const segs = input.segments;

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

            return created(c, { legs });
        }

        // ── Single leg ────────────────────────────────────────────────────
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

        return created(c, leg);
    }, 'trips/:id/days/:dayId/legs POST')
);

/** PUT /api/trips/:id/days/:dayId/legs/:legId */
tripsDayLegsRouter.put(
    '/:legId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');
        const legId = requireParam(c, 'legId');

        const body: unknown = await c.req.json();
        const parsed = UpdateDayLegSchema.safeParse(body);
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
                    paid_by: user.id,
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

        return ok(c, leg);
    }, 'trips/:id/days/:dayId/legs/:legId PUT')
);

/** DELETE /api/trips/:id/days/:dayId/legs/:legId */
tripsDayLegsRouter.delete(
    '/:legId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');
        const legId = requireParam(c, 'legId');

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

        return ok(c, { success: true });
    }, 'trips/:id/days/:dayId/legs/:legId DELETE')
);

/** POST /api/trips/:id/days/:dayId/legs/:legId/boarding-pass */
tripsDayLegsRouter.post(
    '/:legId/boarding-pass',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');
        const legId = requireParam(c, 'legId');

        await requireTripMember(supabase, id, user.id);

        const { data: leg } = await supabase
            .from('legs')
            .select('id')
            .eq('id', legId)
            .eq('day_id', dayId)
            .eq('trip_id', id)
            .single();
        if (!leg) throw Errors.notFound('Spostamento');

        const formData = await c.req.formData();
        const file = formData.get('file') as File | null;
        if (!file) throw Errors.validation('Campo "file" mancante.');

        const ext = file.type === 'application/pdf' ? 'pdf' : file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
        const storagePath = `trips/${id}/boarding-passes/${legId}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        validateFile(file.type, file.size, buffer);
        const publicUrl = await uploadFile(Buckets.tripMedia, storagePath, buffer, file.type);

        const { data: updated, error } = await supabase
            .from('legs')
            .update({ boarding_pass_url: publicUrl })
            .eq('id', legId)
            .select()
            .single();

        if (error) throw new Error(`[motonui][boarding-pass][POST] ${error.message}`);

        return ok(c, updated);
    }, 'trips/:id/days/:dayId/legs/:legId/boarding-pass POST')
);

/** DELETE /api/trips/:id/days/:dayId/legs/:legId/boarding-pass */
tripsDayLegsRouter.delete(
    '/:legId/boarding-pass',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const dayId = requireParam(c, 'dayId');
        const legId = requireParam(c, 'legId');

        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('legs')
            .update({ boarding_pass_url: null })
            .eq('id', legId)
            .eq('day_id', dayId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][boarding-pass][DELETE] ${error.message}`);

        return ok(c, { success: true });
    }, 'trips/:id/days/:dayId/legs/:legId/boarding-pass DELETE')
);
