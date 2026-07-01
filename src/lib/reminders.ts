/**
 * Reminder upsert helpers — called from leg and accommodation API routes.
 * Manages the `reminders` table rows based on the entity's deadline fields.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReminderType } from '@/lib/types';

const DAYS_BEFORE = 3; // send reminders N days before deadline
const HOURS_BEFORE_RESERVATION = 3; // send reminders N hours before restaurant/activity

/**
 * Upsert a single reminder.
 * Deletes any existing reminder of the same type for the entity, then inserts a new one.
 * If `remindAt` is falsy, only deletes — no new reminder is created.
 */
export async function upsertReminder(
    supabase: SupabaseClient,
    opts: {
        userId: string;
        tripId: string;
        entityType: 'leg' | 'accommodation' | 'restaurant' | 'activity';
        entityId: string;
        type: ReminderType;
        remindAt: Date | null;
        title: string;
        message?: string;
    }
): Promise<void> {
    // Always delete the old reminder first so we don't accumulate stale rows
    await supabase
        .from('reminders')
        .delete()
        .eq('entity_id', opts.entityId)
        .eq('type', opts.type);

    if (!opts.remindAt || opts.remindAt < new Date()) return;

    await supabase.from('reminders').insert({
        trip_id: opts.tripId,
        user_id: opts.userId,
        entity_type: opts.entityType,
        entity_id: opts.entityId,
        type: opts.type,
        remind_at: opts.remindAt.toISOString(),
        title: opts.title,
        message: opts.message ?? null,
    });
}

/**
 * Schedules check-in reminder for a flight leg.
 * Sends 1 hour before check-in opens.
 */
export async function upsertFlightCheckinReminder(
    supabase: SupabaseClient,
    opts: {
        userId: string;
        tripId: string;
        legId: string;
        checkinOpensAt: string | null | undefined;
        from: string;
        to: string;
        carrier: string | null | undefined;
    }
): Promise<void> {
    let remindAt: Date | null = null;
    if (opts.checkinOpensAt) {
        remindAt = new Date(new Date(opts.checkinOpensAt).getTime() - 60 * 60 * 1000); // −1h
    }

    await upsertReminder(supabase, {
        userId: opts.userId,
        tripId: opts.tripId,
        entityType: 'leg',
        entityId: opts.legId,
        type: 'flight_checkin',
        remindAt,
        title: `Check-in aperto: ${opts.from.split(',')[0]} → ${opts.to.split(',')[0]}`,
        message: opts.carrier ?? undefined,
    });
}

/**
 * Schedules payment and/or cancellation reminders for an accommodation.
 * Sends DAYS_BEFORE days before each deadline.
 */
export async function upsertAccommodationReminders(
    supabase: SupabaseClient,
    opts: {
        userId: string;
        tripId: string;
        accId: string;
        name: string;
        paymentDeadline: string | null | undefined;
        cancellationDeadline: string | null | undefined;
    }
): Promise<void> {
    // Payment deadline
    const payRemindAt = opts.paymentDeadline
        ? new Date(new Date(opts.paymentDeadline).getTime() - DAYS_BEFORE * 24 * 60 * 60 * 1000)
        : null;
    await upsertReminder(supabase, {
        userId: opts.userId,
        tripId: opts.tripId,
        entityType: 'accommodation',
        entityId: opts.accId,
        type: 'payment_deadline',
        remindAt: payRemindAt,
        title: `Scadenza pagamento: ${opts.name}`,
    });

    // Cancellation deadline
    const canRemindAt = opts.cancellationDeadline
        ? new Date(new Date(opts.cancellationDeadline).getTime() - DAYS_BEFORE * 24 * 60 * 60 * 1000)
        : null;
    await upsertReminder(supabase, {
        userId: opts.userId,
        tripId: opts.tripId,
        entityType: 'accommodation',
        entityId: opts.accId,
        type: 'cancellation_deadline',
        remindAt: canRemindAt,
        title: `Cancellazione gratuita scade il: ${opts.name}`,
    });
}

/**
 * Schedules a reminder for a restaurant reservation.
 * Sends HOURS_BEFORE_RESERVATION hours before the reservation time.
 */
export async function upsertRestaurantReminder(
    supabase: SupabaseClient,
    opts: {
        userId: string;
        tripId: string;
        restaurantId: string;
        name: string;
        date: string;
        time: string;
    }
): Promise<void> {
    const dateTime = new Date(`${opts.date}T${opts.time}:00`);
    const remindAt = new Date(dateTime.getTime() - HOURS_BEFORE_RESERVATION * 60 * 60 * 1000);

    await upsertReminder(supabase, {
        userId: opts.userId,
        tripId: opts.tripId,
        entityType: 'restaurant',
        entityId: opts.restaurantId,
        type: 'restaurant_reservation',
        remindAt,
        title: `Prenotazione ristorante: ${opts.name}`,
        message: `Alle ${opts.time}`,
    });
}

/**
 * Schedules a reminder for an activity/excursion.
 * Sends HOURS_BEFORE_RESERVATION hours before the activity time.
 */
export async function upsertActivityReminder(
    supabase: SupabaseClient,
    opts: {
        userId: string;
        tripId: string;
        activityId: string;
        name: string;
        date: string;
        time: string;
    }
): Promise<void> {
    const dateTime = new Date(`${opts.date}T${opts.time}:00`);
    const remindAt = new Date(dateTime.getTime() - HOURS_BEFORE_RESERVATION * 60 * 60 * 1000);

    await upsertReminder(supabase, {
        userId: opts.userId,
        tripId: opts.tripId,
        entityType: 'activity',
        entityId: opts.activityId,
        type: 'activity_ticket',
        remindAt,
        title: `Attività: ${opts.name}`,
        message: `Alle ${opts.time}`,
    });
}
