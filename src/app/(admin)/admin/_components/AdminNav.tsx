'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ScrollText, ArrowLeft } from 'lucide-react';

const NAV_ITEMS = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/users', label: 'Utenti', icon: Users },
    { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
];

export default function AdminNav() {
    const pathname = usePathname();

    function isActive(href: string, exact?: boolean) {
        if (exact) return pathname === href;
        return pathname === href || pathname.startsWith(href + '/');
    }

    return (
        <>
            <nav className="flex-1 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                            isActive(href, exact)
                                ? 'bg-zinc-800 text-white font-semibold'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
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
        </>
    );
}
