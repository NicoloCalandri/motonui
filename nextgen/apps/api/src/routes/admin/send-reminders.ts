import { Hono } from 'hono';
import { runSendReminders } from '../../lib/cron/send-reminders';
import { env } from '../../lib/env';
import type { AppEnv } from '../../types';

export const sendRemindersRouter = new Hono<AppEnv>();

/**
 * POST /api/admin/send-reminders — sends due travel reminders via email.
 * Protected by the same secret header as /api/admin/cleanup (not
 * requireUser/requireAdmin); kept as a manual/fallback trigger alongside
 * the in-process scheduler (src/scheduler.ts).
 */
sendRemindersRouter.post('/', async (c) => {
    const authHeader = c.req.header('x-admin-secret');
    if (!env.ADMIN_CLEANUP_SECRET || authHeader !== env.ADMIN_CLEANUP_SECRET) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        const result = await runSendReminders();
        return c.json(result);
    } catch (err) {
        return c.json({ error: (err as Error).message }, 500);
    }
});
