'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Map, PlusCircle, BookOpen, LayoutDashboard, User, Plane } from 'lucide-react';

interface AppLayoutProps {
    children: React.ReactNode;
}

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/trips', label: 'Viaggi', icon: Map },
    { href: '/trips/new', label: 'Nuovo', icon: PlusCircle, primary: true },
    { href: '/blog', label: 'Blog', icon: BookOpen },
    { href: '/profile', label: 'Profilo', icon: User },
];

/**
 * Authenticated app shell with sidebar (desktop) and bottom navigation (mobile).
 */
export default function AppLayout({ children }: AppLayoutProps) {
    const router = useRouter();
    const supabase = createClient();
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (!data.user) {
                router.push('/auth/login');
                return;
            }
            setUserEmail(data.user.email ?? null);
        });
    }, [router, supabase.auth]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    return (
        <div className="flex min-h-screen bg-sand-100">
            {/* ─── Desktop Sidebar ─── */}
            <aside className="hidden md:flex flex-col w-64 min-h-screen bg-ink-900 text-sand-100 sticky top-0 h-screen">
                {/* Logo */}
                <div className="p-6 border-b border-ink-500/30">
                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <Plane className="w-7 h-7 text-terracotta-400 group-hover:rotate-12 transition-transform duration-300" />
                        <span className="font-display text-2xl font-bold text-sand-100">motonui</span>
                    </Link>
                    {userEmail && (
                        <p className="text-ink-300 text-xs mt-2 truncate">{userEmail}</p>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {NAV_ITEMS.filter((i) => !i.primary).map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink-300 hover:text-sand-100 hover:bg-ink-500/20 transition-colors duration-150 text-sm font-medium"
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* New Trip CTA */}
                <div className="p-4 border-t border-ink-500/30">
                    <Link
                        href="/trips/new"
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-terracotta-400 hover:bg-terracotta-300 text-white rounded-xl text-sm font-semibold transition-colors duration-150"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Nuovo viaggio
                    </Link>
                    <button
                        onClick={handleSignOut}
                        className="mt-2 w-full px-4 py-2 text-ink-300 hover:text-sand-100 text-xs transition-colors duration-150"
                    >
                        Esci
                    </button>
                </div>
            </aside>

            {/* ─── Main Content ─── */}
            <main className="flex-1 flex flex-col">
                {/* Mobile Header */}
                <header className="md:hidden sticky top-0 z-40 bg-sand-50/90 backdrop-blur-sm border-b border-sand-200 px-4 py-3 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <Plane className="w-6 h-6 text-terracotta-400" />
                        <span className="font-display text-xl font-bold text-ink-900">motonui</span>
                    </Link>
                    <Link
                        href="/trips/new"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta-400 text-white rounded-lg text-sm font-medium"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Nuovo
                    </Link>
                </header>

                {/* Page Content */}
                <div className="flex-1 animate-fade-in">
                    {children}
                </div>

                {/* ─── Mobile Bottom Navigation ─── */}
                <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sand-50/95 backdrop-blur-sm border-t border-sand-200 px-2 pb-safe">
                    <div className="flex items-center justify-around">
                        {NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px] min-h-[44px] transition-colors duration-150 ${primary
                                        ? 'text-terracotta-400'
                                        : 'text-ink-400 hover:text-ink-900'
                                    }`}
                            >
                                <Icon className={`${primary ? 'w-7 h-7' : 'w-5 h-5'}`} />
                                <span className="text-[10px] font-medium">{label}</span>
                            </Link>
                        ))}
                    </div>
                </nav>
            </main>
        </div>
    );
}
