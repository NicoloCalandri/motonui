import { Hono } from 'hono';
import { z } from 'zod';
import { createAdminClient } from '../../lib/supabase/server';
import { requireParam } from '../../lib/http';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import type { AppEnv } from '../../types';

export const adminTripsRouter = new Hono<AppEnv>();

const PatchSchema = z.object({
    status: z.enum(['planning', 'active', 'completed', 'archived']),
});

/** PATCH /api/admin/trips/:id — update trip status (admin only) */
adminTripsRouter.patch('/:id', requireUser, loadProfile, requireAdmin, async (c) => {
    const id = requireParam(c, 'id');

    const body: unknown = await c.req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Parametri non validi.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('trips') as any)
        .update({ status: parsed.data.status })
        .eq('id', id)
        .select('id, status')
        .single();

    if (error) {
        return c.json({ error: error.message, code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json(data);
});
