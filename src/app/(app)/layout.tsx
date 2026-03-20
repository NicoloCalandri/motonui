'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Map, PlusCircle, BookOpen, LayoutDashboard, User, Plane, LogOut } from 'lucide-react';
import ImpersonationBanner from '@/components/admin/impersonation-banner';

interface AppLayoutProps {
    children: React.ReactNode;
}

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/trips', label: 'Viaggi', icon: Map },
    { href: '/blog', label: 'Blog', icon: BookOpen },
    { href: '/profile', label: 'Impostazioni', icon: User },
];

/**
 * Authenticated app shell with sidebar (desktop) and bottom navigation (mobile).
 */
export default function AppLayout({ children }: AppLayoutProps) {
    const router = useRouter();
    const supabase = createClient();
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            if (process.env.NODE_ENV === 'development') {
                setUserEmail('test@example.com');
                setUserName('Dev User');
                return;
            }

            const { data } = await supabase.auth.getUser();
            const user = data.user;

            if (!user) {
                router.push('/auth/login');
                return;
            }
            setUserEmail(user.email ?? null);
            setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Viaggiatore');
        };

        checkUser();
    }, [router, supabase.auth]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    return (
        <div className="flex flex-col min-h-screen bg-[var(--color-bg)]">
            <ImpersonationBanner />
            <div className="flex flex-1">
            {/* ─── Slim Sidebar (Image Reference) ─── */}
            <aside className="hidden md:flex flex-col items-center w-20 min-h-screen bg-[var(--color-sidebar)] py-8 sticky top-0 h-screen">
                <div className="mb-10">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                        M
                    </div>
                </div>

                <nav className="flex-1 w-full px-3 space-y-6 flex flex-col items-center">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            title={label}
                            className="relative group p-3 rounded-2xl transition-all duration-300 hover:bg-white/10 text-gray-500 hover:text-white"
                        >
                            <Icon className="w-6 h-6" />
                            {/* Active indicator mockup (optional) */}
                            <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    ))}
                    
                    <Link
                        href="/trips/new"
                        className="p-3 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
                        <PlusCircle className="w-6 h-6" />
                    </Link>
                </nav>

                <button
                    onClick={handleSignOut}
                    title="Esci"
                    aria-label="Esci"
                    className="p-3 rounded-2xl text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                >
                    <LogOut className="w-6 h-6" />
                </button>
            </aside>

            {/* ─── Main Content Area ─── */}
            <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8">
                {/* Top Cockpit Header */}
                <header className="flex items-center justify-between mb-8">
                    {/* Search Mockup */}
                    <div className="flex-1 max-w-md relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <PlusCircle className="w-5 h-5 text-gray-400 group-focus-within:text-ink-900 transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Cerca il tuo viaggio..." 
                            className="w-full bg-white border-none py-3 pl-12 pr-4 rounded-2xl shadow-soft focus:ring-2 focus:ring-gray-200 transition-all text-sm font-medium"
                        />
                    </div>

                    {/* Actions & Profile */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-soft text-xs font-bold uppercase tracking-wider">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            Light
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-ink-900 leading-none">{userName}</p>
                                <p className="text-[10px] font-medium text-ink-muted mt-1 uppercase">Trip Explorer</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white shadow-soft p-1 overflow-hidden border border-gray-100">
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-400" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {children}
                </div>

                {/* Mobile Bottom Navigation (Still needed for small screens) */}
                <nav className="md:hidden fixed bottom-6 inset-x-4 z-40 bg-[var(--color-sidebar)]/90 backdrop-blur-xl rounded-3xl shadow-2xl p-2 border border-white/10">
                    <div className="flex items-center justify-around">
                        {NAV_ITEMS.concat([{ href: '/trips/new', label: 'Nuovo', icon: PlusCircle }]).map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className="flex flex-col items-center gap-1 py-2 px-3 text-gray-400 hover:text-white transition-all"
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[8px] font-bold uppercase">{label}</span>
                            </Link>
                        ))}
                    </div>
                </nav>
            </main>
            </div>
        </div>
    );
}
