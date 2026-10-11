import { sendEmail } from '../email';
import { log } from '../log';
import { buildReminderEmail, loadReminderEntities } from '../reminder-emails';
import { createAdminClient } from '../supabase/server';

/**
 * Sends the due travel reminders by email: the ones whose `remind_at` is in
 * the past and `sent_at` is null. Port of the handler body of
 * src/app/api/admin/send-reminders/route.ts, as a plain function so that
 * both the HTTP route (routes/admin/send-reminders.ts) and the in-process
 * scheduler (src/scheduler.ts) can call it.
 *
 * Two differences from that handler, both on purpose: the job does nothing
 * when no email provider is configured, and a reminder that cannot be marked
 * as sent counts as failed.
 *
 * The entities a reminder points to are loaded per type by
 * loadReminderEntities: `reminders.entity_id` has no foreign key and cannot
 * be embedded in the query.
 */
export async function runSendReminders(): Promise<{ success: true; sent: number; failed: number }> {
    // Without a provider sendEmail() only logs and returns: marking reminders
    // as sent here would consume them with no email ever leaving.
    if (!process.env.RESEND_API_KEY) {
        log.warn('[motonui][send-reminders] RESEND_API_KEY not set: nothing sent, nothing marked');
        return { success: true, sent: 0, failed: 0 };
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: reminders, error: fetchError } = await supabase
        .from('reminders')
        .select('*')
        .lte('remind_at', now)
        .is('sent_at', null);

    if (fetchError) {
        throw new Error(`[motonui][send-reminders] fetch error: ${fetchError.message}`);
    }

    const entities = await loadReminderEntities(supabase, reminders ?? []);
    let sent = 0;
    let failed = 0;

    for (const reminder of reminders ?? []) {
        try {
            // Get user email from auth (admin only)
            const { data: userResp } = await supabase.auth.admin.getUserById(reminder.user_id);
            const email = userResp?.user?.email;
            if (!email) continue;

            const message = buildReminderEmail(reminder, entities, email.split('@')[0]);
            if (!message) continue;
            const { subject, html } = message;

            await sendEmail({ to: email, subject, html });

            // Mark as sent. Supabase returns the error instead of throwing: an
            // unmarked reminder would be emailed again at every run, so it has
            // to be visible as a failure.
            const { error: markError } = await supabase
                .from('reminders')
                .update({ sent_at: now })
                .eq('id', reminder.id);
            if (markError) throw new Error(`could not mark reminder as sent: ${markError.message}`);

            sent++;
        } catch (err) {
            log.error('[motonui][send-reminders] failed for reminder', reminder.id, err);
            failed++;
        }
    }

    log.info('[motonui][send-reminders]', { sent, failed, total: reminders?.length ?? 0 });
    return { success: true, sent, failed };
}
