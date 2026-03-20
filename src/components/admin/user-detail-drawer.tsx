'use client';

import { useEffect, useState } from 'react';
import { X, Plane, BookOpen, DollarSign, Shield } from 'lucide-react';
import type { AdminUserSummary } from '@/lib/types';

interface Props {
    user: AdminUserSummary;
    onClose: () => void;
    onAction: () => void;
}

interface UserDetail {
    user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        role: string;
        suspendedAt: string | null;
        suspendedReason: string | null;
        createdAt: string;
        lastSignInAt: string | null;
    };
    recentTrips: Array<{ id: string; title: string; destination: string; status: string }>;
    recentPosts: Array<{ id: string; title: string; status: string }>;
    expensesByCurrency: Record<string, number>;
}

export default function UserDetailDrawer({ user, onClose, onAction }: Props) {
    const [detail, setDetail] = useState<UserDetail | null>(null);
    const [tab, setTab] = useState<'trips' | 'posts' | 'expenses'>('trips');

    useEffect(() => {
        fetch(`/api/admin/users/${user.id}`)
            .then(r => r.json())
            .then(setDetail)
            .catch(console.error);
    }, [user.id]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <aside className="relative z-10 w-full max-w-md bg-zinc-900 h-full overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-white">Dettaglio utente</h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Profile section */}
                <div className="p-5 border-b border-zinc-800 flex items-center gap-4">
                    {user.avatarUrl
                        ? <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                        : <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center text-2xl font-bold text-zinc-300">{user.displayName[0]?.toUpperCase()}</div>
                    }
                    <div>
                        <div className="text-xl font-bold text-white">{user.displayName}</div>
                        <div className="text-zinc-400 text-sm">{user.email}</div>
                        <div className="flex gap-2 mt-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-violet-900/60 text-violet-300' : 'bg-zinc-700 text-zinc-300'}`}>
                                {user.role}
                            </span>
                            {user.suspendedAt && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/60 text-red-300">Sospeso</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Meta */}
                <div className="p-5 border-b border-zinc-800 grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div className="text-zinc-500 text-xs">Registrato</div>
                        <div className="text-zinc-200">{new Date(user.createdAt).toLocaleDateString('it-IT')}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500 text-xs">Ultimo accesso</div>
                        <div className="text-zinc-200">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('it-IT') : '—'}</div>
                    </div>
                </div>

                {/* Activity tabs */}
                <div className="flex border-b border-zinc-800">
                    {(['trips', 'posts', 'expenses'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {t === 'trips' ? 'Viaggi' : t === 'posts' ? 'Post' : 'Spese'}
                        </button>
                    ))}
                </div>

                <div className="flex-1 p-5">
                    {!detail ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-zinc-800 rounded animate-pulse" />)}
                        </div>
                    ) : tab === 'trips' ? (
                        detail.recentTrips.length === 0
                            ? <p className="text-zinc-500 text-sm">Nessun viaggio</p>
                            : <ul className="space-y-2">
                                {detail.recentTrips.map(trip => (
                                    <li key={trip.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                        <Plane className="w-4 h-4 text-violet-400 shrink-0" />
                                        <div>
                                            <div className="text-white text-sm font-medium">{trip.title}</div>
                                            <div className="text-zinc-400 text-xs">{trip.destination}</div>
                                        </div>
                                    </li>
                                ))}
                              </ul>
                    ) : tab === 'posts' ? (
                        detail.recentPosts.length === 0
                            ? <p className="text-zinc-500 text-sm">Nessun post</p>
                            : <ul className="space-y-2">
                                {detail.recentPosts.map(post => (
                                    <li key={post.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                        <BookOpen className="w-4 h-4 text-pink-400 shrink-0" />
                                        <div className="text-white text-sm font-medium">{post.title}</div>
                                    </li>
                                ))}
                              </ul>
                    ) : (
                        Object.keys(detail.expensesByCurrency).length === 0
                            ? <p className="text-zinc-500 text-sm">Nessuna spesa</p>
                            : <ul className="space-y-2">
                                {Object.entries(detail.expensesByCurrency).map(([currency, total]) => (
                                    <li key={currency} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <DollarSign className="w-4 h-4 text-amber-400" />
                                            <span className="text-zinc-300 text-sm">{currency}</span>
                                        </div>
                                        <span className="text-white font-semibold">{total.toFixed(2)}</span>
                                    </li>
                                ))}
                              </ul>
                    )}
                </div>
            </aside>
        </div>
    );
}
