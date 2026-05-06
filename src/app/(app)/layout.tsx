'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
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
    const pathname = usePathname();
    const supabase = createClient();
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const checkUser = async () => {
            const res = await fetch('/api/profile');
            if (!res.ok) {
                if (!pathname?.startsWith('/blog')) {
                    router.push('/auth/login');
                }
                return;
            }
            const data = await res.json();
            setUserEmail(data.email ?? null);
            setUserName(data.fullName || data.email?.split('@')[0] || 'Viaggiatore');
            setAvatarUrl(data.avatarUrl ?? null);
        };

        checkUser();
    }, [router]);

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
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                        const active = href === '/dashboard'
                            ? pathname === href
                            : pathname === href || pathname?.startsWith(href + '/');
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={label}
                                className={`relative group p-3 rounded-2xl transition-all duration-300 hover:bg-white/10 ${
                                    active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                                }`}
                            >
                                <Icon className="w-6 h-6" />
                                <div className={`absolute left-[-12px] top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full transition-opacity ${
                                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`} />
                            </Link>
                        );
                    })}
                    
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
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen(v => !v)}
                                className="flex items-center gap-3 focus:outline-none"
                                aria-label="Menu utente"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-ink-900 leading-none">{userName}</p>
                                    <p className="text-[10px] font-medium text-ink-muted mt-1 uppercase">Trip Explorer</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white shadow-soft p-1 overflow-hidden border border-gray-100 flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-white text-[10px] font-bold">
                                            {userName?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50">
                                    <div className="px-4 py-2 border-b border-gray-100">
                                        <p className="text-xs font-semibold text-ink-900 truncate">{userName}</p>
                                        <p className="text-[11px] text-ink-muted truncate">{userEmail}</p>
                                    </div>
                                    <Link
                                        href="/profile"
                                        onClick={() => setMenuOpen(false)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-ink-900 hover:bg-gray-50 transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        Profilo
                                    </Link>
                                    <button
                                        onClick={() => { setMenuOpen(false); handleSignOut(); }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Esci
                                    </button>
                                </div>
                            )}
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
                        {NAV_ITEMS.concat([{ href: '/trips/new', label: 'Nuovo', icon: PlusCircle }]).map(({ href, label, icon: Icon }) => {
                            const active = href === '/dashboard'
                                ? pathname === href
                                : pathname === href || pathname?.startsWith(href + '/');
                            return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex flex-col items-center gap-1 py-2 px-3 transition-all ${
                                    active ? 'text-white' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[8px] font-bold uppercase">{label}</span>
                            </Link>
                            );
                        })}
                    </div>
                </nav>
            </main>
            </div>
        </div>
    );
}
