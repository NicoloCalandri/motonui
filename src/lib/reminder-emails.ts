import type { SupabaseClient } from '@supabase/supabase-js';
import { activityReminderEmail, flightCheckinEmail, paymentDeadlineEmail, restaurantReminderEmail } from '@/lib/email';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Due-reminder emails (cron `send-reminders`).
 *
 * reminders.entity_id is polymorphic (leg, accommodation, restaurant or
 * activity) and has no foreign key, so PostgREST cannot embed the entity:
 * the old `legs:entity_id(...)` select failed on every run. Entities are
 * loaded here with one query per type instead.
 */

type Tables = Database['public']['Tables'];
export type ReminderRow = Tables['reminders']['Row'];
type Leg = Pick<Tables['legs']['Row'], 'id' | 'from_name' | 'to_name' | 'carrier' | 'pnr' | 'booking_ref' | 'departure_at' | 'checkin_opens_at'>;
type Accommodation = Pick<Tables['accommodations']['Row'], 'id' | 'name' | 'booking_ref'>;
type Booking = Pick<Tables['restaurants']['Row'], 'id' | 'name' | 'booking_ref' | 'date' | 'time'>;

export interface ReminderEntities {
    legs: Map<string, Leg>;
    accommodations: Map<string, Accommodation>;
    restaurants: Map<string, Booking>;
    activities: Map<string, Booking>;
}

function idsOf(reminders: ReminderRow[], entityType: string): string[] {
    return [...new Set(reminders.filter((r) => r.entity_type === entityType).map((r) => r.entity_id))];
}

function byId<T extends { id: string }>(rows: T[] | null): Map<string, T> {
    return new Map((rows ?? []).map((row) => [row.id, row]));
}

/** Loads the entities the reminders point to (service-role client). */
export async function loadReminderEntities(admin: SupabaseClient<Database>, reminders: ReminderRow[]): Promise<ReminderEntities> {
    const none = Promise.resolve({ data: [] as never[] });
    const legIds = idsOf(reminders, 'leg');
    const accIds = idsOf(reminders, 'accommodation');
    const restaurantIds = idsOf(reminders, 'restaurant');
    const activityIds = idsOf(reminders, 'activity');

    const [legs, accommodations, restaurants, activities] = await Promise.all([
        legIds.length
            ? admin.from('legs').select('id, from_name, to_name, carrier, pnr, booking_ref, departure_at, checkin_opens_at').in('id', legIds)
            : none,
        accIds.length ? admin.from('accommodations').select('id, name, booking_ref').in('id', accIds) : none,
        restaurantIds.length ? admin.from('restaurants').select('id, name, booking_ref, date, time').in('id', restaurantIds) : none,
        activityIds.length ? admin.from('activities').select('id, name, booking_ref, date, time').in('id', activityIds) : none,
    ]);

    return {
        legs: byId<Leg>(legs.data),
        accommodations: byId<Accommodation>(accommodations.data),
        restaurants: byId<Booking>(restaurants.data),
        activities: byId<Booking>(activities.data),
    };
}

/** Subject and HTML for a reminder, or null if its entity is gone or the type is unknown (pure). */
export function buildReminderEmail(
    reminder: ReminderRow,
    entities: ReminderEntities,
    userName: string,
): { subject: string; html: string } | null {
    if (reminder.type === 'flight_checkin' && reminder.entity_type === 'leg') {
        const leg = entities.legs.get(reminder.entity_id);
        if (!leg) return null;
        return {
            subject: `✈️ Check-in aperto: ${leg.from_name.split(',')[0]} → ${leg.to_name.split(',')[0]}`,
            html: flightCheckinEmail({
                userName,
                from: leg.from_name,
                to: leg.to_name,
                carrier: leg.carrier ?? 'Compagnia aerea',
                pnr: leg.pnr ?? leg.booking_ref,
                departureAt: leg.departure_at ?? '',
                checkinOpensAt: leg.checkin_opens_at ?? '',
            }),
        };
    }

    if ((reminder.type === 'payment_deadline' || reminder.type === 'cancellation_deadline') && reminder.entity_type === 'accommodation') {
        const acc = entities.accommodations.get(reminder.entity_id);
        if (!acc) return null;
        return {
            subject: reminder.type === 'payment_deadline' ? `💳 Scadenza pagamento: ${acc.name}` : `⚠️ Scadenza cancellazione: ${acc.name}`,
            html: paymentDeadlineEmail({ userName, hotelName: acc.name, bookingRef: acc.booking_ref, deadline: reminder.remind_at, type: reminder.type }),
        };
    }

    if (reminder.type === 'restaurant_reservation' && reminder.entity_type === 'restaurant') {
        const rest = entities.restaurants.get(reminder.entity_id);
        if (!rest) return null;
        return {
            subject: `🍽️ Prenotazione ristorante: ${rest.name}`,
            html: restaurantReminderEmail({ userName, restaurantName: rest.name, bookingRef: rest.booking_ref, date: rest.date ?? '', time: rest.time ?? '' }),
        };
    }

    if (reminder.type === 'activity_ticket' && reminder.entity_type === 'activity') {
        const act = entities.activities.get(reminder.entity_id);
        if (!act) return null;
        return {
            subject: `🎟️ Ci siamo quasi: ${act.name}`,
            html: activityReminderEmail({ userName, activityName: act.name, bookingRef: act.booking_ref, date: act.date ?? '', time: act.time ?? '' }),
        };
    }

    return null;
}
