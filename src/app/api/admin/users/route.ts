import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

const QuerySchema = z.object({
    page:      z.coerce.number().min(1).default(1),
    pageSize:  z.coerce.number().min(1).max(100).default(25),
    search:    z.string().optional(),
    role:      z.enum(['user', 'admin', 'all']).default('all'),
    suspended: z.enum(['true', 'false', 'all']).default('all'),
    sortBy:    z.enum(['created_at', 'last_sign_in_at', 'trips_count']).default('created_at'),
    sortDir:   z.enum(['asc', 'desc']).default('desc'),
});

/** GET /api/admin/users — paginated list of all users with stats */
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

    const { page, pageSize, search, role, suspended, sortBy, sortDir } = parsed.data;
    const supabase = await createAdminClient();

    // Build query on the admin_user_view
    let query = (supabase.from('admin_user_view') as any).select('*', { count: 'exact' });

    if (search) {
        query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }
    if (role !== 'all') {
        query = query.eq('role', role);
    }
    if (suspended === 'true') {
        query = query.not('suspended_at', 'is', null);
    } else if (suspended === 'false') {
        query = query.is('suspended_at', null);
    }

    query = query
        .order(sortBy === 'trips_count' ? 'created_at' : sortBy, { ascending: sortDir === 'asc' })
        .range((page - 1) * pageSize, page * pageSize - 1);

    const { data: users, error, count } = await query;
    if (error) {
        console.error('[admin/users GET]', error.message);
        return NextResponse.json(
            { error: 'Errore nel recupero utenti.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    // Aggregate trip/expense/post counts per user using separate queries
    const ids: string[] = (users ?? []).map((u: any) => u.id);
    const [tripsRes, expensesRes, postsRes] = await Promise.all([
        (supabase.from('trips') as any).select('owner_id').in('owner_id', ids),
        (supabase.from('expenses') as any).select('paid_by').in('paid_by', ids),
        (supabase.from('posts') as any).select('author_id').in('author_id', ids),
    ]);

    const tripsCount = buildCountMap(tripsRes.data ?? [], 'owner_id');
    const expensesCount = buildCountMap(expensesRes.data ?? [], 'paid_by');
    const postsCount = buildCountMap(postsRes.data ?? [], 'author_id');

    const enriched = (users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name ?? u.email?.split('@')[0] ?? '',
        avatarUrl: u.avatar_url ?? null,
        role: u.role,
        suspendedAt: u.suspended_at ?? null,
        tripsCount: tripsCount[u.id] ?? 0,
        expensesCount: expensesCount[u.id] ?? 0,
        postsCount: postsCount[u.id] ?? 0,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
    }));

    return ok({ users: enriched, total: count ?? 0, page, pageSize });
}

function buildCountMap(rows: Array<Record<string, string>>, key: string): Record<string, number> {
    const map: Record<string, number> = {};
    for (const row of rows) {
        const id = row[key];
        map[id] = (map[id] ?? 0) + 1;
    }
    return map;
}
