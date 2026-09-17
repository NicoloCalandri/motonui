import cron from 'node-cron';
import { env } from './lib/env';

/**
 * In-process replacement for Vercel Cron (vercel.json's `crons` entry).
 * Gated behind ENABLE_CRON so only one API instance runs jobs if the
 * service is ever scaled horizontally.
 *
 * TODO(phase 3): wire runSendReminders/runCleanup once src/lib/reminders.ts
 * and the cleanup logic are ported to apps/api/src/lib/cron/*.ts.
 */
export function startScheduler() {
    if (!env.ENABLE_CRON) return;

    cron.schedule(
        '0 8 * * *',
        () => {
            console.log('[motonui][cron] send-reminders — not yet ported');
        },
        { timezone: 'Europe/Rome' }
    );

    cron.schedule(
        '0 3 * * *',
        () => {
            console.log('[motonui][cron] cleanup — not yet ported');
        },
        { timezone: 'Europe/Rome' }
    );
}
