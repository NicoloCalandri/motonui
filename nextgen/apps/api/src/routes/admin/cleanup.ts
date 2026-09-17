import { Hono } from 'hono';
import { runCleanup } from '../../lib/cron/cleanup';
import { env } from '../../lib/env';
import type { AppEnv } from '../../types';

export const cleanupRouter = new Hono<AppEnv>();

/**
 * POST /api/admin/cleanup — runs scheduled cleanup tasks.
 * Protected by a static secret header (not requireUser/requireAdmin);
 * intended to be called manually or as a fallback if the in-process
 * scheduler (src/scheduler.ts) is ever disabled.
 */
cleanupRouter.post('/', async (c) => {
    const authHeader = c.req.header('x-admin-secret');
    if (!env.ADMIN_CLEANUP_SECRET || authHeader !== env.ADMIN_CLEANUP_SECRET) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const result = await runCleanup();
    return c.json(result);
});
