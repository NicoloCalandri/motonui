'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Form from 'next/form';
import { Map, BookOpen, Sun, User, LogOut, Search, Plus } from 'lucide-react';
import ImpersonationBanner from '@/components/admin/impersonation-banner';
import { SWRConfig } from 'swr';
import { useProfile, type ProfileResponse } from '@/lib/hooks/use-profile';
import UserMenu from './UserMenu';

interface AppShellProps {
    children: React.ReactNode;
    /** Profile read by the server layout: the first render does not wait for /api/profile. */
    profile: ProfileResponse | null;
}

/** Destinations only, with specific labels. "Nuovo viaggio" is an action: it lives in the header. */
export const NAV_ITEMS = [
    { href: '/dashboard', label: 'Oggi', icon: Sun },
    { href: '/trips', label: 'Viaggi', icon: Map },
    { href: '/blog', label: 'Blog', icon: BookOpen },
    { href: '/profile', label: 'Profilo', icon: User },
];

function isActive(href: string, pathname: string | null): boolean {
    if (href === '/dashboard') return pathname === href;
    return pathname === href || Boolean(pathname?.startsWith(href + '/'));
}

/**
 * Authenticated app shell: dark sidebar (desktop), floating translucent tab bar (mobile).
 */
export default function AppShell({ children, profile }: AppShellProps) {
    return (
        <SWRConfig value={{ fallback: profile ? { '/api/profile': profile } : {} }}>
            <Shell>{children}</Shell>
        </SWRConfig>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();
    const { data: profile, error: profileError } = useProfile();
    const userName = profile ? profile.fullName || profile.email?.split('@')[0] || 'Viaggiatore' : null;

    // No profile means no session: back to login (the public blog excepted).
    useEffect(() => {
        if (profileError && !pathname?.startsWith('/blog')) router.push('/auth/login');
    }, [profileError, pathname, router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    return (
        <div className="flex flex-col min-h-screen bg-canvas text-ink">
            <ImpersonationBanner />
            <div className="flex flex-1">
                <aside className="hidden md:flex flex-col items-center w-[92px] shrink-0 bg-sidebar py-7 px-3 gap-7 sticky top-0 h-screen">
                    <div aria-hidden="true" className="w-11 h-11 rounded-[14px] bg-white/10 flex items-center justify-center text-white font-display font-bold text-xl">
                        m
                    </div>
                    <nav aria-label="Principale" className="flex-1 flex flex-col items-center gap-2">
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href, pathname);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`pressable w-[68px] min-h-[60px] rounded-control flex flex-col items-center justify-center gap-1 text-xs tracking-[0.01em] transition-colors ${
                                        active ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 font-medium hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden="true" />
                                    <span>{label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        aria-label="Esci"
                        title="Esci"
                        className="pressable w-12 h-12 rounded-[14px] text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center"
                    >
                        <LogOut className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </aside>

                <main className="flex-1 min-w-0 flex flex-col px-4 pt-4 pb-32 md:px-10 md:pt-6 md:pb-14">
                    <header className="flex items-center justify-between gap-3 mb-8 max-w-[1180px] w-full mx-auto">
                        {/* Trip search: submits to /trips?q=… with client-side navigation */}
                        <Form action="/trips" role="search" className="flex-1 max-w-[420px] relative group">
                            <label htmlFor="trip-search" className="sr-only">Cerca un viaggio</label>
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-muted pointer-events-none" aria-hidden="true" />
                            <input
                                id="trip-search"
                                type="search"
                                name="q"
                                maxLength={80}
                                placeholder="Cerca un viaggio"
                                className="w-full h-11 bg-surface border border-separator rounded-[14px] pl-11 pr-4 type-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
                            />
                        </Form>
                        <div className="flex items-center gap-2 md:gap-3">
                            <Link
                                href="/trips/new"
                                aria-label="Nuovo viaggio"
                                className="pressable h-11 w-11 md:w-auto md:pl-4 md:pr-5 rounded-pill bg-ink text-white flex items-center justify-center gap-2 type-body font-semibold tracking-[-0.005em]"
                            >
                                <Plus className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
                                <span className="hidden md:inline">Nuovo viaggio</span>
                            </Link>
                            <UserMenu
                                userName={userName}
                                userEmail={profile?.email ?? null}
                                avatarUrl={profile?.avatarUrl ?? null}
                                onSignOut={handleSignOut}
                            />
                        </div>
                    </header>

                    <div className="flex-1 w-full max-w-[1180px] mx-auto">{children}</div>
                </main>
            </div>

            {/* Content scrolls under the bar: a 24px fade where it covers the page, no opaque strip. */}
            <div
                aria-hidden="true"
                className="md:hidden fixed inset-x-0 bottom-0 z-30 pointer-events-none bg-gradient-to-b from-canvas/0 to-canvas/85"
                style={{ height: 'calc(64px + 12px + 24px + env(safe-area-inset-bottom))' }}
            />
            <nav
                aria-label="Principale"
                className="material-bar md:hidden fixed inset-x-3 z-40 h-16 rounded-[28px] p-1 flex items-stretch"
                style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
            >
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href, pathname);
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={`pressable flex-1 rounded-[22px] flex flex-col items-center justify-center gap-0.5 text-xs tracking-[0.01em] ${
                                active ? 'text-ink font-semibold' : 'text-ink-muted font-medium'
                            }`}
                        >
                            <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                            <span>{label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
