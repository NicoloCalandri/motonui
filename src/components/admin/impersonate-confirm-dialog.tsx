'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminUserSummary } from '@/lib/types';

interface Props {
    user: AdminUserSummary;
    onClose: () => void;
}

export default function ImpersonateConfirmDialog({ user, onClose }: Props) {
    const router = useRouter();
    const [confirmed, setConfirmed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStart = async () => {
        if (!confirmed) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/admin/users/${user.id}/impersonate`, { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? 'Errore durante l\'impersonazione.');
                return;
            }

            // Set the impersonation cookie and redirect
            document.cookie = `impersonation_token=${data.token}; path=/; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Lax`;
            router.push('/dashboard');
        } catch {
            setError('Errore di rete. Riprova.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative z-10 bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-zinc-700">
                <h2 className="text-xl font-bold text-white mb-2">Inizia anteprima</h2>
                <p className="text-zinc-400 text-sm mb-5">
                    Stai per visualizzare l&apos;app come <span className="font-semibold text-white">{user.displayName}</span>.
                    Potrai solo leggere, non modificare nulla.
                </p>

                <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-sm text-amber-200 mb-5 space-y-1">
                    <p>⚠️ <strong>Modalità sola lettura</strong> — nessuna scrittura possibile</p>
                    <p>⏱️ La sessione scade dopo <strong>30 minuti</strong></p>
                    <p>📋 Questa azione viene <strong>registrata nell&apos;audit log</strong></p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer mb-6">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={e => setConfirmed(e.target.checked)}
                        className="mt-0.5 accent-white"
                    />
                    <span className="text-sm text-zinc-300">
                        Ho capito che questa azione viene registrata e che non posso modificare dati dell&apos;utente.
                    </span>
                </label>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleStart}
                        disabled={!confirmed || loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Avvio…' : 'Inizia anteprima'}
                    </button>
                </div>
            </div>
        </div>
    );
}
