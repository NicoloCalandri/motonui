import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { ok, Errors } from '@/lib/errors';

/** GET /api/profile — returns current user's id, email, full_name, avatar_url */
export async function GET() {
    try {
        const supabase = await createClient();
        const user = await getAuthUser(supabase);

        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', user.id)
            .single();

        return ok({
            id: user.id,
            email: user.email ?? null,
            fullName: profile?.display_name ?? '',
            avatarUrl: profile?.avatar_url ?? null,
        });
    } catch (e: unknown) {
        const error = e as Partial<{ message: string; code: string; status: number }>;
        return NextResponse.json(
            { error: error.message ?? 'Errore server.', code: error.code ?? 'INTERNAL_ERROR', status: error.status ?? 500 },
            { status: error.status ?? 500 }
        );
    }
}

/** PATCH /api/profile — updates display_name in the profiles table */
export async function PATCH(request: Request) {
    try {
        const supabase = await createClient();
        const user = await getAuthUser(supabase);

        const body: unknown = await request.json();
        const fullNameValue = typeof body === 'object' && body !== null ? (body as { fullName?: unknown }).fullName : undefined;
        const fullName = typeof fullNameValue === 'string' ? fullNameValue.trim() : null;

        if (fullName === null) {
            return NextResponse.json(
                { error: 'Il campo fullName è obbligatorio.', code: 'VALIDATION_ERROR', status: 400 },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('profiles')
            .update({ display_name: fullName })
            .eq('id', user.id);

        if (error) {
            return NextResponse.json(
                { error: 'Errore durante l\'aggiornamento del profilo.', code: 'DB_ERROR', status: 500 },
                { status: 500 }
            );
        }

        return ok({ fullName });
    } catch (e: unknown) {
        const error = e as Partial<{ message: string; code: string; status: number }>;
        return NextResponse.json(
            { error: error.message ?? 'Errore server.', code: error.code ?? 'INTERNAL_ERROR', status: error.status ?? 500 },
            { status: error.status ?? 500 }
        );
    }
}
