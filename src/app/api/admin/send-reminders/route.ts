import { createAdminClient } from '@/lib/supabase/server';
import { isAuthorizedCronRequest } from '@/lib/auth/cron';
import { Errors, ok, withErrorHandler } from '@/lib/errors';
import { sendEmail } from '@/lib/email';
import { buildReminderEmail, loadReminderEntities } from '@/lib/reminder-emails';
import { log } from '@/lib/log';

/**
 * GET /api/admin/send-reminders — sends due travel reminders via email.
 *
 * Called daily by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer ${CRON_SECRET}` (T-2.6).
 * Sends reminders whose `remind_at` is in the past and `sent_at` is null.
 * Uses the trip owner's email from auth.users.
 */
export const GET = withErrorHandler(async (request) => {
    if (!isAuthorizedCronRequest(request)) throw Errors.unauthorized();

    // Without a provider sendEmail() only logs and returns: marking reminders
    // as sent here would consume them with no email ever leaving.
    if (!process.env.RESEND_API_KEY) {
        log.warn('[motonui][send-reminders] RESEND_API_KEY not set: nothing sent, nothing marked');
        return ok({ success: true, sent: 0, failed: 0 });
    }

    const supabase = await createAdminClient();
    const now = new Date().toISOString();

    // Unsent due reminders; their entities are loaded per type (no FK to embed).
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
    return ok({ success: true, sent, failed });
}, 'admin/send-reminders GET');
