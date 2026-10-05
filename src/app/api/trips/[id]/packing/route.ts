import { z } from 'zod';
import { withRoute } from '@/lib/api/with-route';
import { tripParams } from '@/lib/api/params';
import { createClient } from '@/lib/supabase/server';
import { Errors, ok } from '@/lib/errors';
import { requireFeatureAccess } from '@/lib/premium/access';
import { geocodeDestination, getTripWeather } from '@/lib/weather';
import { generatePackingChecklist, computePackingInputHash } from '@/lib/ai/packing';
import type { BaggageItem, PackingCategoryGroup } from '@/lib/types';
import { fromJson, toJson } from '@/lib/json';

interface TripForPacking {
    destination: string;
    start_date: string | null;
    end_date: string | null;
    days: { id: string; date: string; title: string | null; legs: { from_name: string; to_name: string; from_lat: number | null; from_lng: number | null }[] }[];
    activities: { name: string; type: string; date: string | null }[];
}

async function loadTripContext(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string) {
    const { data: trip, error: tripError } = await supabase.from('trips')
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

/** GET /api/trips/[id]/packing — current checklist + staleness flag */
export const GET = withRoute(
    { name: 'trips/[id]/packing GET', params: tripParams(), tripMember: true },
    async ({ supabase, params }) => {
    const { id } = params;
    const { data: checklist, error } = await supabase.from('packing_checklists')
        .select('*')
        .eq('trip_id', id)
        .maybeSingle();

    if (error) throw new Error(`[motonui][packing][GET] ${error.message}`);

    if (!checklist) {
        return ok({ checklist: null, stale: false });
    }

    const { trip, baggage } = await loadTripContext(supabase, id);
    const currentHash = computePackingInputHash({
        startDate: trip.start_date,
        endDate: trip.end_date,
        baggage,
        activityCount: trip.activities?.length ?? 0,
        stopCount: trip.days?.length ?? 0,
    });

    return ok({
        checklist: {
            trip_id: id,
            categories: fromJson<PackingCategoryGroup[]>(checklist.items),
            weather_snapshot: checklist.weather_snapshot,
            input_hash: checklist.input_hash,
            generated_at: checklist.generated_at,
            checked_item_ids: checklist.checked_item_ids ?? [],
            updated_at: checklist.updated_at,
        },
        stale: checklist.input_hash !== currentHash,
    });
});

/** POST /api/trips/[id]/packing — generate/regenerate the AI checklist */
export const POST = withRoute(
    { name: 'trips/[id]/packing POST', params: tripParams(), tripMember: true },
    async ({ supabase, user, params }) => {
    const { id } = params;
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

    const { error: upsertError } = await supabase.from('packing_checklists').upsert(
        {
            trip_id: id,
            items: toJson(categories),
            weather_snapshot: toJson(weather),
            input_hash: inputHash,
            generated_at: new Date().toISOString(),
            checked_item_ids: [],
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'trip_id' }
    );

    if (upsertError) throw new Error(`[motonui][packing][POST] ${upsertError.message}`);

    return ok({
        trip_id: id,
        categories,
        weather_snapshot: weather,
        input_hash: inputHash,
        generated_at: new Date().toISOString(),
        checked_item_ids: [],
    });
});

const ToggleSchema = z.object({
    itemId: z.string().min(1),
    checked: z.boolean(),
});

/** PATCH /api/trips/[id]/packing — toggle a checklist item's checked state */
export const PATCH = withRoute(
    { name: 'trips/[id]/packing PATCH', params: tripParams(), body: ToggleSchema, tripMember: true },
    async ({ supabase, params, body }) => {
    const { id } = params;
    const { data: current, error: fetchError } = await supabase.from('packing_checklists')
        .select('checked_item_ids')
        .eq('trip_id', id)
        .single();

    if (fetchError || !current) throw Errors.notFound('Checklist');

    const existing: string[] = current.checked_item_ids ?? [];
    const next = body.checked
        ? Array.from(new Set([...existing, body.itemId]))
        : existing.filter((itemId) => itemId !== body.itemId);

    const { error: updateError } = await supabase.from('packing_checklists')
        .update({ checked_item_ids: next, updated_at: new Date().toISOString() })
        .eq('trip_id', id);

    if (updateError) throw new Error(`[motonui][packing][PATCH] ${updateError.message}`);

    return ok({ checked_item_ids: next });
});
