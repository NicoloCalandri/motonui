'use client';

import { useEffect, useState } from 'react';
import type { AdminUserSummary } from '@/lib/types';

interface Props {
    user: AdminUserSummary;
    onClose: () => void;
    onSuccess: () => void;
}

const PREMIUM_FEATURES = [
    { key: 'ai_blog', label: 'AI Blog Assistant' },
    { key: 'ai_generate_post', label: 'AI Generate Post' },
    { key: 'ai_destination', label: 'AI Destination Briefing' },
    { key: 'instagram_caption', label: 'Instagram Caption AI' },
    { key: 'advanced_reminders', label: 'Reminder avanzati' },
] as const;

export default function EditUserDialog({ user, onClose, onSuccess }: Props) {
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [role, setRole] = useState<'user' | 'admin'>(user.role);
    const [plan, setPlan] = useState<'free' | 'premium'>(user.plan ?? 'free');
    const [premiumUntil, setPremiumUntil] = useState(
        user.premiumUntil ? new Date(user.premiumUntil).toISOString().slice(0, 10) : ''
    );
    const [premiumReason, setPremiumReason] = useState('');
    const [entitlements, setEntitlements] = useState(
        PREMIUM_FEATURES.map((f) => ({
            featureKey: f.key,
            enabled: plan === 'premium',
            dailyLimit: '',
            monthlyLimit: '',
        }))
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const loadDetails = async () => {
            try {
                const res = await fetch(`/api/admin/users/${user.id}`);
                if (!res.ok) return;
                const payload: {
                    user?: { plan?: 'free' | 'premium'; premiumUntil?: string | null };
                    entitlements?: Array<{
                        featureKey: string;
                        enabled?: boolean;
                        dailyLimit?: number | null;
                        monthlyLimit?: number | null;
                    }>;
                } = await res.json();
                if (!mounted) return;
                const detailUser = payload.user;
                if (detailUser?.plan) setPlan(detailUser.plan);
                if (detailUser?.premiumUntil) {
                    setPremiumUntil(new Date(detailUser.premiumUntil).toISOString().slice(0, 10));
                }
                if (Array.isArray(payload.entitlements)) {
                    setEntitlements(PREMIUM_FEATURES.map((feature) => {
                        const existing = payload.entitlements.find((e) => e.featureKey === feature.key);
                        return {
                            featureKey: feature.key,
                            enabled: existing ? Boolean(existing.enabled) : (detailUser?.plan === 'premium'),
                            dailyLimit: existing?.dailyLimit?.toString?.() ?? '',
                            monthlyLimit: existing?.monthlyLimit?.toString?.() ?? '',
                        };
                    }));
                }
            } catch {
                // keep defaults
            }
        };
        loadDetails();
        return () => {
            mounted = false;
        };
    }, [user.id]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName,
                    role,
                    plan,
                    premiumUntil: plan === 'premium' && premiumUntil ? new Date(`${premiumUntil}T23:59:59.000Z`).toISOString() : null,
                    premiumReason: premiumReason.trim() || undefined,
                    entitlements: entitlements.map((e) => ({
                        ...e,
                        dailyLimit: e.dailyLimit === '' ? null : Number(e.dailyLimit),
                        monthlyLimit: e.monthlyLimit === '' ? null : Number(e.monthlyLimit),
                    })),
                }),
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

                    <label className="block">
                        <span className="text-sm text-zinc-300 mb-1.5 block">Piano</span>
                        <select
                            value={plan}
                            onChange={e => {
                                const nextPlan = e.target.value as 'free' | 'premium';
                                setPlan(nextPlan);
                                setEntitlements((prev) => prev.map((item) => ({
                                    ...item,
                                    enabled: nextPlan === 'premium' ? item.enabled : false,
                                })));
                            }}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500"
                        >
                            <option value="free">Free</option>
                            <option value="premium">Premium</option>
                        </select>
                    </label>

                    {plan === 'premium' && (
                        <>
                            <label className="block">
                                <span className="text-sm text-zinc-300 mb-1.5 block">Premium fino al (opzionale)</span>
                                <input
                                    type="date"
                                    value={premiumUntil}
                                    onChange={e => setPremiumUntil(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500"
                                />
                            </label>
                            <label className="block">
                                <span className="text-sm text-zinc-300 mb-1.5 block">Motivo modifica premium (audit)</span>
                                <textarea
                                    value={premiumReason}
                                    onChange={e => setPremiumReason(e.target.value)}
                                    placeholder="Motivo interno"
                                    className="w-full min-h-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                                />
                            </label>
                            <div className="rounded-lg border border-zinc-700 p-3 space-y-3">
                                <p className="text-sm text-zinc-300">Feature premium</p>
                                {entitlements.map((item) => {
                                    const meta = PREMIUM_FEATURES.find((f) => f.key === item.featureKey)!;
                                    return (
                                        <div key={item.featureKey} className="space-y-2 rounded-md bg-zinc-800/60 p-2">
                                            <label className="flex items-center justify-between gap-2 text-xs text-zinc-200">
                                                <span>{meta.label}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={item.enabled}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setEntitlements((prev) => prev.map((current) =>
                                                            current.featureKey === item.featureKey
                                                                ? { ...current, enabled: checked }
                                                                : current
                                                        ));
                                                    }}
                                                />
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={item.dailyLimit}
                                                    onChange={(e) => setEntitlements((prev) => prev.map((current) =>
                                                        current.featureKey === item.featureKey
                                                            ? { ...current, dailyLimit: e.target.value }
                                                            : current
                                                    ))}
                                                    placeholder="Limite giorno"
                                                    className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                                                />
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={item.monthlyLimit}
                                                    onChange={(e) => setEntitlements((prev) => prev.map((current) =>
                                                        current.featureKey === item.featureKey
                                                            ? { ...current, monthlyLimit: e.target.value }
                                                            : current
                                                    ))}
                                                    placeholder="Limite mese"
                                                    className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
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
