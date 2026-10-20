import { Hono } from 'hono';
import { runCleanup } from '../../lib/cron/cleanup';
import { requireCronSecret } from '../../middleware/cron';
import type { AppEnv } from '../../types';

export const cleanupRouter = new Hono<AppEnv>();

/**
 * GET|POST /api/admin/cleanup — runs the scheduled cleanup tasks.
 * Called by a scheduler (Vercel Cron sends GET) with the cron secret, not by
 * a signed-in user: see middleware/cron.ts.
 */
cleanupRouter.on(['GET', 'POST'], '/', requireCronSecret, async (c) => c.json(await runCleanup()));
