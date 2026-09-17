import { Hono } from 'hono';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthUser } from '../lib/auth/get-user';
import { withErrorHandler, ok, requireParam } from '../lib/http';
import { Errors } from '../lib/errors';
import { requireTripMember } from '../lib/authz';
import { requireFeatureAccess } from '../lib/premium/access';
import { geocodeDestination, getTripWeather } from '../lib/weather';
import { generatePackingChecklist, computePackingInputHash } from '../lib/ai/packing';
import type { BaggageItem, PackingCategoryGroup } from '@motonui/shared-types';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/trips/:id/packing
export const tripsPackingRouter = new Hono<AppEnv>();

interface TripForPacking {
    destination: string;
    start_date: string | null;
    end_date: string | null;
    days: { id: string; date: string; title: string | null; legs: { from_name: string; to_name: string; from_lat: number | null; from_lng: number | null }[] }[];
    activities: { name: string; type: string; date: string | null }[];
}

async function loadTripContext(supabase: SupabaseClient, tripId: string) {
    const { data: trip, error: tripError } = await (supabase.from('trips') as any)
        .select('destination, start_date, end_date, days(id, date, title, legs(from_name, to_name, from_lat, from_lng)), activities(name, type, date)')
        .eq('id', tripId)
        .single();

    if (tripError || !trip) throw Errors.notFound('Viaggio');

    const { data: baggage, error: baggageError } = await supabase
        .from('baggage_items')
        .select('*')
        .eq('trip_id', tripId);

    if (baggageError) throw new Error(`[motonui][packing][baggage] ${baggageError.message}`);

    return { trip: trip as TripForPacking, baggage: (baggage || []) as BaggageItem[] };
}

/** GET /api/trips/:id/packing — current checklist + staleness flag */
tripsPackingRouter.get(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const { data: checklist, error } = await (supabase.from('packing_checklists') as any)
            .select('*')
            .eq('trip_id', id)
            .maybeSingle();

        if (error) throw new Error(`[motonui][packing][GET] ${error.message}`);

        if (!checklist) {
            return ok(c, { checklist: null, stale: false });
        }

        const { trip, baggage } = await loadTripContext(supabase, id);
        const currentHash = computePackingInputHash({
            startDate: trip.start_date,
            endDate: trip.end_date,
            baggage,
            activityCount: trip.activities?.length ?? 0,
            stopCount: trip.days?.length ?? 0,
        });

        return ok(c, {
            checklist: {
                trip_id: id,
                categories: checklist.items as PackingCategoryGroup[],
                weather_snapshot: checklist.weather_snapshot,
                input_hash: checklist.input_hash,
                generated_at: checklist.generated_at,
                checked_item_ids: checklist.checked_item_ids ?? [],
                updated_at: checklist.updated_at,
            },
            stale: checklist.input_hash !== currentHash,
        });
    }, 'trips/:id/packing GET')
);

/** POST /api/trips/:id/packing — generate/regenerate the AI checklist */
tripsPackingRouter.post(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);
        await requireFeatureAccess({ userId: user.id, feature: 'packing_checklist' });

        const { trip, baggage } = await loadTripContext(supabase, id);

        if (!trip.start_date || !trip.end_date) {
            throw Errors.validation('Imposta le date del viaggio prima di generare la checklist.');
        }

        const firstCoords = trip.days
            ?.flatMap((d) => d.legs ?? [])
            .find((l) => l.from_lat != null && l.from_lng != null);

        const coords = firstCoords
            ? { lat: firstCoords.from_lat as number, lng: firstCoords.from_lng as number }
            : await geocodeDestination(trip.destination);

        const weather = coords
            ? await getTripWeather(coords.lat, coords.lng, trip.start_date, trip.end_date, supabase)
            : [];

        const stops = (trip.days ?? []).map((d) => ({
            name: d.title || d.legs?.[0]?.to_name || `Giorno ${d.date}`,
            date: d.date,
        }));

        const activities = (trip.activities ?? []).map((a) => ({ name: a.name, type: a.type, date: a.date }));

        const categories = await generatePackingChecklist({
            destination: trip.destination,
            startDate: trip.start_date,
            endDate: trip.end_date,
            weather,
            stops,
            activities,
            baggage,
        });

        const inputHash = computePackingInputHash({
            startDate: trip.start_date,
            endDate: trip.end_date,
            baggage,
            activityCount: activities.length,
            stopCount: stops.length,
        });

        const { error: upsertError } = await (supabase.from('packing_checklists') as any).upsert(
            {
                trip_id: id,
                items: categories,
                weather_snapshot: weather,
                input_hash: inputHash,
                generated_at: new Date().toISOString(),
                checked_item_ids: [],
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'trip_id' }
        );

        if (upsertError) throw new Error(`[motonui][packing][POST] ${upsertError.message}`);

        return ok(c, {
            trip_id: id,
            categories,
            weather_snapshot: weather,
            input_hash: inputHash,
            generated_at: new Date().toISOString(),
            checked_item_ids: [],
        });
    }, 'trips/:id/packing POST')
);

const ToggleSchema = z.object({
    itemId: z.string().min(1),
    checked: z.boolean(),
});

/** PATCH /api/trips/:id/packing — toggle a checklist item's checked state */
tripsPackingRouter.patch(
    '/',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const supabase = c.get('supabase');
        const user = await getAuthUser(supabase);
        const id = requireParam(c, 'id');

        await requireTripMember(supabase, id, user.id);

        const body = await c.req.json();
        const parsed = ToggleSchema.safeParse(body);
        if (!parsed.success) throw Errors.validation(parsed.error.message);

        const { data: current, error: fetchError } = await (supabase.from('packing_checklists') as any)
            .select('checked_item_ids')
            .eq('trip_id', id)
            .single();

        if (fetchError || !current) throw Errors.notFound('Checklist');

        const existing: string[] = current.checked_item_ids ?? [];
        const next = parsed.data.checked
            ? Array.from(new Set([...existing, parsed.data.itemId]))
            : existing.filter((itemId) => itemId !== parsed.data.itemId);

        const { error: updateError } = await (supabase.from('packing_checklists') as any)
            .update({ checked_item_ids: next, updated_at: new Date().toISOString() })
            .eq('trip_id', id);

        if (updateError) throw new Error(`[motonui][packing][PATCH] ${updateError.message}`);

        return ok(c, { checked_item_ids: next });
    }, 'trips/:id/packing PATCH')
);
