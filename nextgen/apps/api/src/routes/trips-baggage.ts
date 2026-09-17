import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember, requireLegInTrip } from '../lib/authz';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/baggage
export const tripsBaggageRouter = new Hono<AppEnv>();

const CreateBaggageItemSchema = z.object({
    leg_id: z.string().uuid().nullable().optional(),
    category: z.enum(['cabin_bag', 'cabin_trolley', 'checked', 'other']),
    label: z.string().nullable().optional(),
    length_cm: z.number().positive().nullable().optional(),
    width_cm: z.number().positive().nullable().optional(),
    height_cm: z.number().positive().nullable().optional(),
    weight_kg: z.number().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
});

const UpdateBaggageItemSchema = CreateBaggageItemSchema;

tripsBaggageRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const { data, error } = await supabase
            .from('baggage_items')
            .select('*')
            .eq('trip_id', id)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`[motonui][baggage][GET] ${error.message}`);

        return ok(c, data || []);
    }, 'trips/:id/baggage GET')
);

tripsBaggageRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = CreateBaggageItemSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const data = parsed.data;
        await requireLegInTrip(supabase, id, data.leg_id);

        const { data: inserted, error } = await supabase
            .from('baggage_items')
            .insert({
                trip_id: id,
                leg_id: data.leg_id ?? null,
                category: data.category,
                label: data.label ?? null,
                length_cm: data.length_cm ?? null,
                width_cm: data.width_cm ?? null,
                height_cm: data.height_cm ?? null,
                weight_kg: data.weight_kg ?? null,
                notes: data.notes ?? null,
            })
            .select()
            .single();

        if (error) throw new Error(`[motonui][baggage][POST] ${error.message}`);

        return ok(c, inserted, 201);
    }, 'trips/:id/baggage POST')
);

tripsBaggageRouter.put(
    '/:baggageId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const baggageId = requireParam(c, 'baggageId');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = UpdateBaggageItemSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const data = parsed.data;
        await requireLegInTrip(supabase, id, data.leg_id);

        const { error } = await supabase
            .from('baggage_items')
            .update({
                leg_id: data.leg_id ?? null,
                category: data.category,
                label: data.label ?? null,
                length_cm: data.length_cm ?? null,
                width_cm: data.width_cm ?? null,
                height_cm: data.height_cm ?? null,
                weight_kg: data.weight_kg ?? null,
                notes: data.notes ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', baggageId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][baggage][PUT] ${error.message}`);
        return ok(c, { success: true });
    }, 'trips/:id/baggage/:baggageId PUT')
);

tripsBaggageRouter.delete(
    '/:baggageId',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');
        const baggageId = requireParam(c, 'baggageId');

        await requireTripMember(supabase, id, user.id);

        const { error } = await supabase
            .from('baggage_items')
            .delete()
            .eq('id', baggageId)
            .eq('trip_id', id);

        if (error) throw new Error(`[motonui][baggage][DELETE] ${error.message}`);
        return ok(c, { success: true });
    }, 'trips/:id/baggage/:baggageId DELETE')
);
