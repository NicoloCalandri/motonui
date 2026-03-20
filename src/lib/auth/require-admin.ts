import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type AdminResult = { adminId: string } | NextResponse;

/**
 * Verifies the caller is an authenticated admin.
 * Returns { adminId } on success, or a NextResponse error on failure.
 *
 * Usage in route handlers:
 *   const result = await requireAdmin();
 *   if (result instanceof NextResponse) return result;
 *   const { adminId } = result;
 */
export async function requireAdmin(): Promise<AdminResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json(
            { error: 'Non autenticato.', code: 'UNAUTHORIZED', status: 401 },
            { status: 401 }
        );
    }

    const { data: profile } = await (supabase.from('profiles') as any)
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json(
            { error: 'Accesso non autorizzato.', code: 'FORBIDDEN', status: 403 },
            { status: 403 }
        );
    }

    return { adminId: user.id };
}
