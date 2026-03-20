import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import { ok } from '@/lib/errors';

/** GET /api/profile/stats — trip and post counts for the current user */
export async function GET() {
    try {
        const supabase = await createClient();
        const user = await getAuthUser(supabase);

        const [tripsRes, postsRes] = await Promise.all([
            supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
        ]);

        return ok({ trips: tripsRes.count ?? 0, posts: postsRes.count ?? 0 });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message ?? 'Errore server.', code: e.code ?? 'INTERNAL_ERROR', status: e.status ?? 500 },
            { status: e.status ?? 500 }
        );
    }
}
