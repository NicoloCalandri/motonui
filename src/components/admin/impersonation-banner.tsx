'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ImpersonationInfo {
    targetName: string | null;
}

/**
 * Fixed banner shown at the top of all app pages when an admin is
 * impersonating another user. Fetches the display name from the JWT cookie.
 */
export default function ImpersonationBanner() {
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [targetName, setTargetName] = useState<string | null>(null);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const hasToken = document.cookie.includes('impersonation_token=');
        setVisible(hasToken);

        if (hasToken) {
            // Decode the display name from the user_role cookie or use a generic label
            const userRoleCookie = document.cookie
                .split('; ')
                .find(c => c.startsWith('impersonation_display_name='));
            setTargetName(userRoleCookie ? decodeURIComponent(userRoleCookie.split('=')[1]) : 'questo utente');
        }
    }, []);

    const handleExit = async () => {
        setExiting(true);
        try {
            await fetch('/api/admin/impersonate/exit', { method: 'POST' });
            // Clear cookie client-side too
            document.cookie = 'impersonation_token=; max-age=0; path=/';
            router.push('/admin/users');
        } catch {
            setExiting(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow">
            <span>
                ⚠️ Stai visualizzando l&apos;app come{' '}
                <strong>{targetName ?? 'questo utente'}</strong>
                {' '}— modalità sola lettura
            </span>
            <button
                onClick={handleExit}
                disabled={exiting}
                className="ml-4 px-3 py-1 rounded-lg bg-amber-950/20 hover:bg-amber-950/30 transition-colors disabled:opacity-60 text-xs font-semibold"
            >
                {exiting ? 'Uscita…' : 'Esci dall\'anteprima'}
            </button>
        </div>
    );
}
