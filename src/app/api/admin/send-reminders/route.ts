import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';
import { sendEmail, flightCheckinEmail, paymentDeadlineEmail, restaurantReminderEmail, activityReminderEmail } from '@/lib/email';

const ADMIN_SECRET = process.env.ADMIN_CLEANUP_SECRET;

/**
 * POST /api/admin/send-reminders — sends due travel reminders via email.
 *
 * Called daily by Vercel Cron (see vercel.json).
 * Sends reminders whose `remind_at` is in the past and `sent_at` is null.
 * Uses the trip owner's email from auth.users.
 *
 * Protected by the same ADMIN_CLEANUP_SECRET used for the cleanup cron.
 */
export async function POST(request: Request): Promise<Response> {
    const authHeader = request.headers.get('x-admin-secret');
    if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createAdminClient();
    const now = new Date().toISOString();

    // Fetch all unsent due reminders
    const { data: reminders, error: fetchError } = await (supabase as any)
        .from('reminders')
        .select(`
            *,
            trips ( id, title, owner_id ),
            legs:entity_id ( id, from_name, to_name, carrier, pnr, booking_ref, departure_at, checkin_opens_at ),
            accommodations:entity_id ( id, name, booking_ref ),
            restaurants:entity_id ( id, name, booking_ref, date, time ),
            activities:entity_id ( id, name, booking_ref, date, time )
        `)
        .lte('remind_at', now)
        .is('sent_at', null);

    if (fetchError) {
        console.error('[motonui][send-reminders] fetch error', fetchError.message);
        return Response.json({ error: fetchError.message }, { status: 500 });
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders ?? []) {
        try {
            // Get user email from auth (admin only)
            const { data: userResp } = await supabase.auth.admin.getUserById(reminder.user_id);
            const email = userResp?.user?.email;
            if (!email) continue;

            const userName = email.split('@')[0];

            let html = '';
            let subject = '';

            if (reminder.type === 'flight_checkin' && reminder.entity_type === 'leg') {
                const leg = reminder.legs;
                if (!leg) continue;
                subject = `✈️ Check-in aperto: ${leg.from_name?.split(',')[0]} → ${leg.to_name?.split(',')[0]}`;
                html = flightCheckinEmail({
                    userName,
                    from: leg.from_name ?? '',
                    to: leg.to_name ?? '',
                    carrier: leg.carrier ?? 'Compagnia aerea',
                    pnr: leg.pnr ?? leg.booking_ref,
                    departureAt: leg.departure_at ?? '',
                    checkinOpensAt: leg.checkin_opens_at ?? '',
                });
            } else if (
                (reminder.type === 'payment_deadline' || reminder.type === 'cancellation_deadline') &&
                reminder.entity_type === 'accommodation'
            ) {
                const acc = reminder.accommodations;
                if (!acc) continue;
                subject = reminder.type === 'payment_deadline'
                    ? `💳 Scadenza pagamento: ${acc.name}`
                    : `⚠️ Scadenza cancellazione: ${acc.name}`;
                html = paymentDeadlineEmail({
                    userName,
                    hotelName: acc.name ?? '',
                    bookingRef: acc.booking_ref,
                    deadline: reminder.remind_at,
                    type: reminder.type,
                });
            } else if (reminder.type === 'restaurant_reservation' && reminder.entity_type === 'restaurant') {
                const rest = reminder.restaurants;
                if (!rest) continue;
                subject = `🍽️ Prenotazione ristorante: ${rest.name}`;
                html = restaurantReminderEmail({
                    userName,
                    restaurantName: rest.name ?? '',
                    bookingRef: rest.booking_ref,
                    date: rest.date ?? '',
                    time: rest.time ?? '',
                });
            } else if (reminder.type === 'activity_ticket' && reminder.entity_type === 'activity') {
                const act = reminder.activities;
                if (!act) continue;
                subject = `🎟️ Attività: ${act.name}`;
                html = activityReminderEmail({
                    userName,
                    activityName: act.name ?? '',
                    bookingRef: act.booking_ref,
                    date: act.date ?? '',
                    time: act.time ?? '',
                });
            } else {
                continue;
            }

            await sendEmail({ to: email, subject, html });

            // Mark as sent
            await (supabase as any)
                .from('reminders')
                .update({ sent_at: now })
                .eq('id', reminder.id);

            sent++;
        } catch (err) {
            console.error('[motonui][send-reminders] failed for reminder', reminder.id, err);
            failed++;
        }
    }

    console.info('[motonui][send-reminders]', { sent, failed, total: reminders?.length ?? 0 });
    return ok({ success: true, sent, failed });
}
