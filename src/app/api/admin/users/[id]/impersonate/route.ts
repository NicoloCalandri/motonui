import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

const IMPERSONATION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

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

    const expiresAt = Date.now() + IMPERSONATION_DURATION_MS;

    // Sign the JWT
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

    // Persist token in DB for revocation support
    const expiresAtDate = new Date(expiresAt).toISOString();
    await supabase.from('impersonation_tokens').insert({
        admin_id: adminId,
        target_id: targetId,
        token,
        expires_at: expiresAtDate,
    });

    await supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        action: 'impersonate',
        target_id: targetId,
        metadata: { display_name: targetProfile.display_name },
    });

    return ok({ token });
}
