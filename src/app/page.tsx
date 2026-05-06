import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';
import LandingClient from '@/components/landing-client';

export default async function RootPage() {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    // If already logged in, redirect to dashboard
    if (user) {
        redirect('/dashboard');
    }

    return <LandingClient />;
}
