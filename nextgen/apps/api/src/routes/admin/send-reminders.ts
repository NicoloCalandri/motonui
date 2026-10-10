import { Hono } from 'hono';
import { runSendReminders } from '../../lib/cron/send-reminders';
import { requireCronSecret } from '../../middleware/cron';
import type { AppEnv } from '../../types';

export const sendRemindersRouter = new Hono<AppEnv>();

/**
 * GET|POST /api/admin/send-reminders — sends the due travel reminders.
 * Called by a scheduler with the cron secret (middleware/cron.ts). A failure
 * goes to the app error handler: its message is logged, not returned.
 */
sendRemindersRouter.on(['GET', 'POST'], '/', requireCronSecret, async (c) => c.json(await runSendReminders()));
