'use client';

import { useState } from 'react';
import type { AdminUserSummary } from '@/lib/types';

interface Props {
    user: AdminUserSummary;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DeleteUserDialog({ user, onClose, onSuccess }: Props) {
    const [confirmEmail, setConfirmEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValid = confirmEmail === user.email;

    const handleDelete = async () => {
        if (!isValid) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmEmail }),
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
                <h2 className="text-xl font-bold text-white mb-2">Elimina account</h2>
                <p className="text-zinc-400 text-sm mb-2">
                    Stai per eliminare definitivamente l&apos;account di{' '}
                    <span className="font-semibold text-white">{user.displayName}</span>.
                    Questa operazione è <span className="text-red-400 font-semibold">irreversibile</span> e rimuoverà tutti i dati.
                </p>

                <p className="text-zinc-400 text-sm mb-5">
                    Digita l&apos;email dell&apos;utente per confermare:{' '}
                    <span className="font-mono text-zinc-300">{user.email}</span>
                </p>

                <label className="block mb-5">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Email di conferma *</span>
                    <input
                        type="email"
                        value={confirmEmail}
                        onChange={e => setConfirmEmail(e.target.value)}
                        placeholder={user.email}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                </label>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm">
                        Annulla
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!isValid || loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Eliminazione…' : 'Elimina definitivamente'}
                    </button>
                </div>
            </div>
        </div>
    );
}
