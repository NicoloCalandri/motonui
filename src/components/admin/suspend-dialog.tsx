'use client';

import { useState } from 'react';
import type { AdminUserSummary } from '@/lib/types';

interface Props {
    user: AdminUserSummary;
    onClose: () => void;
    onSuccess: () => void;
}

export default function SuspendDialog({ user, onClose, onSuccess }: Props) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!reason.trim()) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Errore.'); return; }
            onSuccess();
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
                <h2 className="text-xl font-bold text-white mb-2">Sospendi account</h2>
                <p className="text-zinc-400 text-sm mb-5">
                    Stai per sospendere <span className="font-semibold text-white">{user.displayName}</span>.
                    L&apos;utente non potrà accedere all&apos;app fino alla riattivazione.
                </p>

                <label className="block mb-5">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Motivo della sospensione *</span>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Descrivi il motivo…"
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                    <div className="text-right text-xs text-zinc-500 mt-1">{reason.length}/500</div>
                </label>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm">
                        Annulla
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!reason.trim() || loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Sospensione…' : 'Sospendi'}
                    </button>
                </div>
            </div>
        </div>
    );
}
