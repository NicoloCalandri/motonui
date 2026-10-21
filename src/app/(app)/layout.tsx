import { createClient } from '@/lib/supabase/server';
import { getOptionalAuthUser } from '@/lib/auth/get-user';
import AppShell from '@/components/shell/AppShell';
import type { ProfileResponse } from '@/lib/hooks/use-profile';

/**
 * Server half of the app shell: reads the profile once, so the shell renders
 * name and avatar without a client round trip to /api/profile. Same shape as
 * GET /api/profile, which SWR keeps using for revalidation.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const user = await getOptionalAuthUser(supabase);
    let profile: ProfileResponse | null = null;
    if (user) {
        const { data } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', user.id)
            .single();
        profile = {
            id: user.id,
            email: user.email ?? null,
            fullName: data?.display_name ?? '',
            avatarUrl: data?.avatar_url ?? null,
        };
    }
    return <AppShell profile={profile}>{children}</AppShell>;
}
