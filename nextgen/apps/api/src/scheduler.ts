import cron from 'node-cron';
import { env } from './lib/env';
import { runSendReminders } from './lib/cron/send-reminders';
import { runCleanup } from './lib/cron/cleanup';

/**
 * In-process replacement for Vercel Cron (vercel.json's `crons` entry).
 * Gated behind ENABLE_CRON so only one API instance runs jobs if the
 * service is ever scaled horizontally.
 */
export function startScheduler() {
    if (!env.ENABLE_CRON) return;

    cron.schedule(
        '0 8 * * *',
        () => {
            runSendReminders().catch((err) => console.error('[motonui][cron] send-reminders failed', err));
        },
        { timezone: 'Europe/Rome' }
    );

    cron.schedule(
        '0 3 * * *',
        () => {
            runCleanup().catch((err) => console.error('[motonui][cron] cleanup failed', err));
        },
        { timezone: 'Europe/Rome' }
    );
}
