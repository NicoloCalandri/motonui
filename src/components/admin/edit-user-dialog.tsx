'use client';

import { useState } from 'react';
import type { AdminUserSummary } from '@/lib/types';

interface Props {
    user: AdminUserSummary;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditUserDialog({ user, onClose, onSuccess }: Props) {
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [role, setRole] = useState<'user' | 'admin'>(user.role);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName, role }),
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
                <h2 className="text-xl font-bold text-white mb-5">Modifica utente</h2>

                <div className="space-y-4 mb-5">
                    <label className="block">
                        <span className="text-sm text-zinc-300 mb-1.5 block">Email</span>
                        <input
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-500 cursor-not-allowed"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm text-zinc-300 mb-1.5 block">Nome visualizzato</span>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Nome utente"
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm text-zinc-300 mb-1.5 block">Ruolo</span>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value as 'user' | 'admin')}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500"
                        >
                            <option value="user">Utente normale</option>
                            <option value="admin">Amministratore</option>
                        </select>
                    </label>
                </div>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm">
                        Annulla
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white text-zinc-900 font-semibold hover:bg-zinc-200 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Salvataggio…' : 'Salva modifiche'}
                    </button>
                </div>
            </div>
        </div>
    );
}
