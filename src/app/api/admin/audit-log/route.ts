import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

const QuerySchema = z.object({
    page:      z.coerce.number().min(1).default(1),
    pageSize:  z.coerce.number().min(1).max(100).default(25),
    adminId:   z.string().uuid().optional(),
    action:    z.enum(['impersonate', 'suspend', 'unsuspend', 'delete', 'view_profile', 'all']).default('all'),
    targetId:  z.string().uuid().optional(),
    dateFrom:  z.string().optional(),
    dateTo:    z.string().optional(),
    export:    z.enum(['csv']).optional(),
});

/** GET /api/admin/audit-log — paginated, filterable audit log */
export async function GET(request: Request) {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Parametri non validi.', code: 'VALIDATION_ERROR', status: 400 },
            { status: 400 }
        );
    }

    const { page, pageSize, adminId, action, targetId, dateFrom, dateTo, export: exportFormat } = parsed.data;
    const supabase = await createAdminClient();

    let query = (supabase.from('admin_audit_log') as any)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (adminId)  query = query.eq('admin_id', adminId);
    if (action !== 'all') query = query.eq('action', action);
    if (targetId) query = query.eq('target_id', targetId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo)   query = query.lte('created_at', dateTo);

    if (exportFormat === 'csv') {
        // Return up to 1000 rows for CSV export
        query = query.limit(1000);
        const { data } = await query;
        const csv = toCsv(data ?? []);
        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="audit-log.csv"',
            },
        });
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) {
        console.error('[admin/audit-log GET]', error.message);
        return NextResponse.json(
            { error: 'Errore nel recupero audit log.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
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

    return ok({ data: entries, total: count ?? 0, page, pageSize });
}

function toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.join(','),
        ...rows.map(row =>
            headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
        ),
    ];
    return lines.join('\n');
}
