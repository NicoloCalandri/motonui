import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { LayoutDashboard, Users, ScrollText, Settings, ArrowLeft } from 'lucide-react';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const NAV_ITEMS = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/users', label: 'Utenti', icon: Users },
    { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
];

/** Server-side admin role check — defence in depth beyond middleware */
async function checkAdminAccess() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');

    const { data: profile } = await (supabase.from('profiles') as any)
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

                <nav className="flex-1 space-y-1">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="border-t border-zinc-800 pt-4">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Torna all&apos;app
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col">
                {children}
            </main>
        </div>
    );
}
