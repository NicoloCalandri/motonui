import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { createImpersonationToken, IMPERSONATION_DURATION_SECONDS } from '@/lib/admin/impersonation-token';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/impersonate */
export async function POST(_req: Request, { params }: Params) {
    const { id: targetId } = await params;
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { adminId } = result;

    const secret = process.env.ADMIN_IMPERSONATION_SECRET;
    if (!secret || secret.length < 32) {
        console.error('[admin/impersonate] ADMIN_IMPERSONATION_SECRET is missing or too short');
        return NextResponse.json(
            { error: 'Configurazione server non corretta.', code: 'INTERNAL_ERROR', status: 500 },
            { status: 500 }
        );
    }

    const supabase = await createAdminClient();

    // Ensure target user exists
    const { data: targetProfile } = await supabase.from('profiles')
        .select('id, display_name')
        .eq('id', targetId)
        .single();

    if (!targetProfile) {
        return NextResponse.json(
            { error: 'Utente non trovato.', code: 'NOT_FOUND', status: 404 },
            { status: 404 }
        );
    }

    // Signed with a random jti; only SHA-256(jti) is stored, so a database
    // leak does not leak usable tokens and exit can revoke by jti (T-1.8).
    const { token, jtiHash, expiresAt } = await createImpersonationToken({ adminId, targetId }, secret);

    await supabase.from('impersonation_tokens').insert({
        admin_id: adminId,
        target_id: targetId,
        token: jtiHash,
        expires_at: expiresAt.toISOString(),
    });

    await supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'impersonate',
        target_id: targetId,
        metadata: { display_name: targetProfile.display_name },
    });

    // The token itself never reaches client-side JS: it's set as an httpOnly
    // cookie only. A separate, non-sensitive cookie carries the display name
    // so the UI can show a banner without ever touching the token.
    const response = NextResponse.json({ started: true });
    response.cookies.set('impersonation_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: IMPERSONATION_DURATION_SECONDS,
        path: '/',
    });
    response.cookies.set('impersonation_display_name', targetProfile.display_name ?? 'utente', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: IMPERSONATION_DURATION_SECONDS,
        path: '/',
    });

    return response;
}
