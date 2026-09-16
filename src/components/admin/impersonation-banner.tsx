'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Fixed banner shown at the top of all app pages when an admin is
 * impersonating another user. Detects the active session from the
 * non-sensitive display-name cookie (the token cookie is httpOnly and
 * never touched by client-side JS).
 */
export default function ImpersonationBanner() {
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [targetName, setTargetName] = useState<string | null>(null);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const displayNameCookie = document.cookie
            .split('; ')
            .find(c => c.startsWith('impersonation_display_name='));

        if (displayNameCookie) {
            setVisible(true);
            setTargetName(decodeURIComponent(displayNameCookie.split('=')[1]));
        }
    }, []);

    const handleExit = async () => {
        setExiting(true);
        try {
            await fetch('/api/admin/impersonate/exit', { method: 'POST' });
            setVisible(false);
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
