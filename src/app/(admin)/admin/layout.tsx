import { getAuthUser } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from './_components/AdminNav';

interface AdminLayoutProps {
    children: React.ReactNode;
}

/** Server-side admin role check — defence in depth beyond middleware */
async function checkAdminAccess() {
    if (process.env.NODE_ENV === 'development') return;
        const supabase = await createClient();
        const user = await getAuthUser(supabase);
    if (!user) redirect('/auth/login');

    const { data: profile } = await supabase.from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') redirect('/dashboard');
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
    await checkAdminAccess();

    return (
        <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-56 min-h-screen bg-zinc-900 border-r border-zinc-800 py-6 px-3 sticky top-0 h-screen">
                <div className="mb-8 px-3">
                    <span className="text-xs font-semibold tracking-widest uppercase text-zinc-500">
                        Admin Panel
                    </span>
                    <div className="text-lg font-bold text-white mt-1">motonui</div>
                </div>

                <AdminNav />
            </aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col">
                {children}
            </main>
        </div>
    );
}
