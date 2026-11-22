import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { hashJti, readJti } from '@/lib/admin/impersonation-token';
import { withAdminRoute } from '@/lib/api/with-admin-route';

/** POST /api/admin/impersonate/exit — end an impersonation session */
export const POST = withAdminRoute('admin/impersonate/exit POST', async ({ request }) => {

    const cookieHeader = request.headers.get('cookie') ?? '';
    const tokenMatch = cookieHeader.match(/impersonation_token=([^;]+)/);
    const token = tokenMatch?.[1];

    const jti = token ? readJti(decodeURIComponent(token)) : null;
    if (jti) {
        const supabase = await createAdminClient();

        // Revoke: the middleware refuses tokens whose jti hash is no longer stored.
        await supabase.from('impersonation_tokens')
            .delete()
            .eq('token', await hashJti(jti));
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
    response.cookies.set('impersonation_display_name', '', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    return response;
});
