import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ok } from '@/lib/errors';
import type { ImpersonationPayload } from '@/lib/types';

/** POST /api/admin/impersonate/exit — end an impersonation session */
export async function POST(request: Request) {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const cookieHeader = request.headers.get('cookie') ?? '';
    const tokenMatch = cookieHeader.match(/impersonation_token=([^;]+)/);
    const token = tokenMatch?.[1];

    if (token) {
        const supabase = await createAdminClient();

        // Remove the token from the DB
        await (supabase.from('impersonation_tokens') as any)
            .delete()
            .eq('token', token);
    }

    // Clear the impersonation cookie and redirect admin back
    const response = NextResponse.json({ exited: true });
    response.cookies.set('impersonation_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    return response;
}
