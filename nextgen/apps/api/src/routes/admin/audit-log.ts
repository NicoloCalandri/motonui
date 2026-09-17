import { Hono } from 'hono';
import { z } from 'zod';
import { createAdminClient } from '../../lib/supabase/server';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import type { AppEnv } from '../../types';

export const auditLogRouter = new Hono<AppEnv>();

const QuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(25),
    adminId: z.string().uuid().optional(),
    action: z.enum(['impersonate', 'suspend', 'unsuspend', 'delete', 'view_profile', 'update_user', 'premium_update', 'all']).default('all'),
    targetId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    export: z.enum(['csv']).optional(),
});

function toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.join(','),
        ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
    ];
    return lines.join('\n');
}

/** GET /api/admin/audit-log — paginated, filterable audit log */
auditLogRouter.get('/', requireUser, loadProfile, requireAdmin, async (c) => {
    const parsed = QuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json({ error: 'Parametri non validi.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const { page, pageSize, adminId, action, targetId, dateFrom, dateTo, export: exportFormat } = parsed.data;
    const supabase = createAdminClient();

    let query = (supabase as any)
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (adminId) query = query.eq('admin_id', adminId);
    if (action !== 'all') query = query.eq('action', action);
    if (targetId) query = query.eq('target_id', targetId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    if (exportFormat === 'csv') {
        query = query.limit(1000);
        const { data } = await query;
        const csv = toCsv(data ?? []);
        c.header('Content-Type', 'text/csv');
        c.header('Content-Disposition', 'attachment; filename="audit-log.csv"');
        return c.body(csv);
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) {
        console.error('[admin/audit-log GET]', error.message);
        return c.json({ error: 'Errore nel recupero audit log.', code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

    const entries = (data ?? []).map((row: any) => ({
        id: row.id,
        admin_id: row.admin_id,
        admin_email: row.admin_email ?? null,
        action: row.action,
        target_user_id: row.target_user_id ?? row.target_id ?? null,
        target_email: row.target_email ?? null,
        details: row.details ?? row.metadata ?? null,
        created_at: row.created_at,
    }));

    return c.json({ data: entries, total: count ?? 0, page, pageSize });
});
