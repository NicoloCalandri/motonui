import cron from 'node-cron';
import { env } from './lib/env';
import { runSendReminders } from './lib/cron/send-reminders';
import { runCleanup } from './lib/cron/cleanup';
import { captureError } from './lib/monitoring';

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
            runSendReminders().catch((err: unknown) => captureError(err, { route: 'cron:send-reminders' }));
        },
        { timezone: 'Europe/Rome' }
    );

    cron.schedule(
        '0 3 * * *',
        () => {
            runCleanup().catch((err: unknown) => captureError(err, { route: 'cron:cleanup' }));
        },
        { timezone: 'Europe/Rome' }
    );
}
