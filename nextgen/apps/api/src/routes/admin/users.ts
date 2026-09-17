import { Hono } from 'hono';
import { z } from 'zod';
import { setCookie } from 'hono/cookie';
import { SignJWT } from 'jose';
import { createAdminClient } from '../../lib/supabase/server';
import { requireParam } from '../../lib/http';
import { requireUser } from '../../middleware/auth';
import { loadProfile } from '../../middleware/profile';
import { requireAdmin } from '../../middleware/admin';
import { env } from '../../lib/env';
import type { AppEnv } from '../../types';

export const usersRouter = new Hono<AppEnv>();

usersRouter.use('*', requireUser, loadProfile, requireAdmin);

const QuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(25),
    search: z.string().optional(),
    role: z.enum(['user', 'admin', 'all']).default('all'),
    plan: z.enum(['free', 'premium', 'all']).default('all'),
    suspended: z.enum(['true', 'false', 'all']).default('all'),
    sortBy: z.enum(['created_at', 'last_sign_in_at', 'trips_count']).default('created_at'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    displayName: z.string().min(1).optional(),
    role: z.enum(['user', 'admin']).default('user'),
    plan: z.enum(['free', 'premium']).default('free'),
    premiumUntil: z.string().datetime().nullable().optional(),
});

const UpdateSchema = z.object({
    displayName: z.string().min(1).optional(),
    role: z.enum(['user', 'admin']).optional(),
    plan: z.enum(['free', 'premium']).optional(),
    premiumUntil: z.string().datetime().nullable().optional(),
    premiumReason: z.string().max(500).optional(),
    entitlements: z.array(z.object({
        featureKey: z.enum(['ai_blog', 'ai_generate_post', 'ai_destination', 'instagram_caption', 'advanced_reminders']),
        enabled: z.boolean().default(true),
        dailyLimit: z.number().int().nonnegative().nullable().optional(),
        monthlyLimit: z.number().int().nonnegative().nullable().optional(),
    })).optional(),
});

const SuspendSchema = z.object({
    reason: z.string().min(1).max(500),
});

const DeleteSchema = z.object({
    confirmEmail: z.string().email(),
});

function buildCountMap(rows: Array<Record<string, string>>, key: string): Record<string, number> {
    const map: Record<string, number> = {};
    for (const row of rows) {
        const id = row[key];
        map[id] = (map[id] ?? 0) + 1;
    }
    return map;
}

async function writeAuditLog(
    supabase: ReturnType<typeof createAdminClient>,
    adminId: string,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>
) {
    await (supabase as any).from('admin_audit_log').insert({
        admin_id: adminId,
        action,
        target_id: targetId,
        metadata: metadata ?? null,
    });
}

async function loadEntitlements(supabase: ReturnType<typeof createAdminClient>, userId: string) {
    const { data } = await (supabase as any)
        .from('feature_entitlements')
        .select('feature_key, enabled, daily_limit, monthly_limit')
        .eq('user_id', userId)
        .order('feature_key', { ascending: true });
    return (data ?? []).map((e: any) => ({
        featureKey: e.feature_key,
        enabled: Boolean(e.enabled),
        dailyLimit: e.daily_limit ?? null,
        monthlyLimit: e.monthly_limit ?? null,
    }));
}

/** GET /api/admin/users — paginated list of all users with stats */
usersRouter.get('/', async (c) => {
    const parsed = QuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json({ error: 'Parametri non validi.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const { page, pageSize, search, role, plan, suspended, sortBy, sortDir } = parsed.data;
    const supabase = createAdminClient();

    let query = (supabase as any).from('admin_user_view').select('*', { count: 'exact' });

    if (search) {
        query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }
    if (role !== 'all') query = query.eq('role', role);
    if (plan !== 'all') query = query.eq('plan', plan);
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
        return c.json({ error: 'Errore nel recupero utenti.', code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

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
        plan: u.plan ?? 'free',
        premiumUntil: u.premium_until ?? null,
        suspendedAt: u.suspended_at ?? null,
        tripsCount: tripsCount[u.id] ?? 0,
        expensesCount: expensesCount[u.id] ?? 0,
        postsCount: postsCount[u.id] ?? 0,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
    }));

    return c.json({ users: enriched, total: count ?? 0, page, pageSize });
});

/** POST /api/admin/users — create a new user */
usersRouter.post('/', async (c) => {
    const adminId = c.get('adminId');
    const body: unknown = await c.req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Dati non validi.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: {
            display_name: parsed.data.displayName,
        },
    });

    if (error) {
        console.error('[admin/users POST]', error.message);
        return c.json({ error: 'Errore nella creazione utente: ' + error.message, code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

    if (data.user) {
        const updates: any = { role: parsed.data.role, plan: parsed.data.plan };
        if (parsed.data.displayName) updates.display_name = parsed.data.displayName;
        if (parsed.data.plan === 'premium') {
            updates.premium_enabled_at = new Date().toISOString();
            updates.premium_until = parsed.data.premiumUntil ?? null;
            updates.premium_enabled_by = adminId;
        }

        await (supabase as any).from('profiles').update(updates).eq('id', data.user.id);
    }

    return c.json({ user: data.user }, 201);
});

/** GET /api/admin/users/:id — full profile of a single user */
usersRouter.get('/:id', async (c) => {
    const id = requireParam(c, 'id');
    const adminId = c.get('adminId');
    const supabase = createAdminClient();

    const { data: userRow, error } = await (supabase as any)
        .from('admin_user_view')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !userRow) {
        return c.json({ error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 }, 404);
    }

    const [tripsRes, postsRes, expensesRes] = await Promise.all([
        (supabase.from('trips') as any)
            .select('id, title, destination, status, start_date, end_date')
            .eq('owner_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
        (supabase.from('posts') as any)
            .select('id, title, status, published_at')
            .eq('author_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
        (supabase.from('expenses') as any)
            .select('amount_eur, currency')
            .eq('paid_by', id),
    ]);

    const expensesByCurrency: Record<string, number> = {};
    for (const exp of expensesRes.data ?? []) {
        expensesByCurrency[exp.currency] = (expensesByCurrency[exp.currency] ?? 0) + Number(exp.amount_eur ?? 0);
    }

    await writeAuditLog(supabase, adminId, 'view_profile', id);

    return c.json({
        user: {
            id: userRow.id,
            email: userRow.email,
            displayName: userRow.display_name ?? '',
            avatarUrl: userRow.avatar_url ?? null,
            role: userRow.role,
            plan: userRow.plan ?? 'free',
            premiumUntil: userRow.premium_until ?? null,
            premiumEnabledAt: userRow.premium_enabled_at ?? null,
            premiumEnabledBy: userRow.premium_enabled_by ?? null,
            suspendedAt: userRow.suspended_at ?? null,
            suspendedReason: userRow.suspended_reason ?? null,
            createdAt: userRow.created_at,
            lastSignInAt: userRow.last_sign_in_at ?? null,
        },
        recentTrips: tripsRes.data ?? [],
        recentPosts: postsRes.data ?? [],
        expensesByCurrency,
        entitlements: await loadEntitlements(supabase, id),
    });
});

/** PUT /api/admin/users/:id — update a user */
usersRouter.put('/:id', async (c) => {
    const id = requireParam(c, 'id');
    const adminId = c.get('adminId');

    if (adminId === id) {
        return c.json({ error: 'Non puoi modificare il tuo stesso ruolo qui.', code: 'FORBIDDEN', status: 403 }, 403);
    }

    const body: unknown = await c.req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Dati non validi.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const supabase = createAdminClient();

    const updates: Record<string, any> = {};
    if (parsed.data.displayName !== undefined) updates.display_name = parsed.data.displayName;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.plan !== undefined) updates.plan = parsed.data.plan;
    if (parsed.data.premiumUntil !== undefined) updates.premium_until = parsed.data.premiumUntil;

    if (parsed.data.plan === 'premium') {
        updates.premium_enabled_at = new Date().toISOString();
        updates.premium_enabled_by = adminId;
    }
    if (parsed.data.plan === 'free') {
        updates.premium_until = null;
    }

    if (Object.keys(updates).length > 0) {
        const { error } = await (supabase as any).from('profiles').update(updates).eq('id', id);
        if (error) {
            console.error('[admin/users PUT]', error.message);
            return c.json({ error: "Errore durante l'aggiornamento.", code: 'INTERNAL_ERROR', status: 500 }, 500);
        }
    }

    if (parsed.data.entitlements) {
        for (const entitlement of parsed.data.entitlements) {
            await (supabase as any).from('feature_entitlements').upsert({
                user_id: id,
                feature_key: entitlement.featureKey,
                enabled: entitlement.enabled,
                daily_limit: entitlement.dailyLimit ?? null,
                monthly_limit: entitlement.monthlyLimit ?? null,
                updated_at: new Date().toISOString(),
            });
        }
    }

    const changedPremiumFields = parsed.data.plan !== undefined
        || parsed.data.premiumUntil !== undefined
        || parsed.data.entitlements !== undefined;
    await writeAuditLog(
        supabase,
        adminId,
        changedPremiumFields ? 'premium_update' : 'update_user',
        id,
        {
            ...updates,
            premiumReason: parsed.data.premiumReason ?? null,
            entitlements: parsed.data.entitlements ?? null,
        }
    );

    return c.json({ updated: true });
});

/** DELETE /api/admin/users/:id — delete a user (requires email confirmation) */
usersRouter.delete('/:id', async (c) => {
    const id = requireParam(c, 'id');
    const adminId = c.get('adminId');

    if (adminId === id) {
        return c.json({ error: 'Non puoi eliminare il tuo stesso account.', code: 'FORBIDDEN', status: 403 }, 403);
    }

    const body: unknown = await c.req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Email di conferma mancante.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const supabase = createAdminClient();

    const { data: userRow } = await (supabase as any)
        .from('admin_user_view')
        .select('email')
        .eq('id', id)
        .single();

    if (!userRow) {
        return c.json({ error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 }, 404);
    }

    if (userRow.email !== parsed.data.confirmEmail) {
        return c.json({ error: 'Email di conferma non corrisponde.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    await writeAuditLog(supabase, adminId, 'delete', id, { email: userRow.email });

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
        console.error('[admin/users DELETE]', error.message);
        return c.json({ error: "Impossibile eliminare l'utente.", code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

    return c.json({ deleted: true });
});

/** POST /api/admin/users/:id/suspend */
usersRouter.post('/:id/suspend', async (c) => {
    const id = requireParam(c, 'id');
    const adminId = c.get('adminId');

    if (adminId === id) {
        return c.json({ error: 'Non puoi sospendere il tuo stesso account.', code: 'FORBIDDEN', status: 403 }, 403);
    }

    const body: unknown = await c.req.json();
    const parsed = SuspendSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Motivo di sospensione mancante.', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const supabase = createAdminClient();

    const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({
            suspended_at: new Date().toISOString(),
            suspended_reason: parsed.data.reason,
        })
        .eq('id', id);

    if (updateError) {
        console.error('[admin/users/suspend]', updateError.message);
        return c.json({ error: "Impossibile sospendere l'utente.", code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

    await writeAuditLog(supabase, adminId, 'suspend', id, { reason: parsed.data.reason });

    return c.json({ suspended: true });
});

/** POST /api/admin/users/:id/unsuspend */
usersRouter.post('/:id/unsuspend', async (c) => {
    const id = requireParam(c, 'id');
    const adminId = c.get('adminId');
    const supabase = createAdminClient();

    const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ suspended_at: null, suspended_reason: null })
        .eq('id', id);

    if (updateError) {
        console.error('[admin/users/unsuspend]', updateError.message);
        return c.json({ error: "Impossibile riattivare l'utente.", code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

    await writeAuditLog(supabase, adminId, 'unsuspend', id);

    return c.json({ unsuspended: true });
});

const IMPERSONATION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const IMPERSONATION_DURATION_SECONDS = IMPERSONATION_DURATION_MS / 1000;

/** POST /api/admin/users/:id/impersonate */
usersRouter.post('/:id/impersonate', async (c) => {
    const targetId = requireParam(c, 'id');
    const adminId = c.get('adminId');

    const secret = env.ADMIN_IMPERSONATION_SECRET;
    if (!secret || secret.length < 32) {
        console.error('[admin/impersonate] ADMIN_IMPERSONATION_SECRET is missing or too short');
        return c.json({ error: 'Configurazione server non corretta.', code: 'INTERNAL_ERROR', status: 500 }, 500);
    }

    const supabase = createAdminClient();

    const { data: targetProfile } = await (supabase as any)
        .from('profiles')
        .select('id, display_name')
        .eq('id', targetId)
        .single();

    if (!targetProfile) {
        return c.json({ error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 }, 404);
    }

    const expiresAt = Date.now() + IMPERSONATION_DURATION_MS;

    const secretKey = new TextEncoder().encode(secret);
    const token = await new SignJWT({
        adminId,
        targetId,
        expiresAt,
        type: 'impersonation',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30m')
        .sign(secretKey);

    const expiresAtDate = new Date(expiresAt).toISOString();
    await (supabase as any).from('impersonation_tokens').insert({
        admin_id: adminId,
        target_id: targetId,
        token,
        expires_at: expiresAtDate,
    });

    await writeAuditLog(supabase, adminId, 'impersonate', targetId, { display_name: targetProfile.display_name });

    setCookie(c, 'impersonation_token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: IMPERSONATION_DURATION_SECONDS,
        path: '/',
    });
    setCookie(c, 'impersonation_display_name', targetProfile.display_name ?? 'utente', {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: IMPERSONATION_DURATION_SECONDS,
        path: '/',
    });

    return c.json({ started: true });
});
