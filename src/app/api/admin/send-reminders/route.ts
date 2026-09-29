import { createAdminClient } from '@/lib/supabase/server';
import { isAuthorizedCronRequest } from '@/lib/auth/cron';
import { Errors, ok, withErrorHandler } from '@/lib/errors';
import { sendEmail } from '@/lib/email';
import { buildReminderEmail, loadReminderEntities } from '@/lib/reminder-emails';

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

            // Mark as sent
            await supabase
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
}, 'admin/send-reminders GET');
