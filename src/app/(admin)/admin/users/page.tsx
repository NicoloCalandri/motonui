'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AdminUserSummary } from '@/lib/types';
import UserDetailDrawer from '@/components/admin/user-detail-drawer';
import ImpersonateConfirmDialog from '@/components/admin/impersonate-confirm-dialog';
import SuspendDialog from '@/components/admin/suspend-dialog';
import DeleteUserDialog from '@/components/admin/delete-user-dialog';
import CreateUserDialog from '@/components/admin/create-user-dialog';
import EditUserDialog from '@/components/admin/edit-user-dialog';
import { Plus } from 'lucide-react';

type SortDir = 'asc' | 'desc';
type SortBy = 'created_at' | 'last_sign_in_at' | 'trips_count';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUserSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
    const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'premium'>('all');
    const [suspendedFilter, setSuspendedFilter] = useState<'all' | 'true' | 'false'>('all');
    const [sortBy, setSortBy] = useState<SortBy>('created_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [loading, setLoading] = useState(true);

    const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
    const [impersonateTarget, setImpersonateTarget] = useState<AdminUserSummary | null>(null);
    const [suspendTarget, setSuspendTarget] = useState<AdminUserSummary | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
    const [editTarget, setEditTarget] = useState<AdminUserSummary | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: String(page),
            pageSize: '25',
            sortBy,
            sortDir,
            role: roleFilter,
            plan: planFilter,
            suspended: suspendedFilter,
        });
        if (debouncedSearch) params.set('search', debouncedSearch);

        try {
            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();
            setUsers(data.users ?? []);
            setTotal(data.total ?? 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, sortBy, sortDir, roleFilter, planFilter, suspendedFilter, debouncedSearch]);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    const toggleSort = (col: SortBy) => {
        if (sortBy === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ col }: { col: SortBy }) =>
        sortBy === col
            ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
            : null;

    const totalPages = Math.ceil(total / 25);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Utenti</h1>
                    <p className="text-zinc-400 text-sm mt-1">{total.toLocaleString('it-IT')} account registrati</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" /> Nuovo utente
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Cerca nome o email…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={e => { setRoleFilter(e.target.value as typeof roleFilter); setPage(1); }}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                >
                    <option value="all">Tutti i ruoli</option>
                    <option value="user">Utenti</option>
                    <option value="admin">Admin</option>
                </select>
                <select
                    value={planFilter}
                    onChange={e => { setPlanFilter(e.target.value as typeof planFilter); setPage(1); }}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                >
                    <option value="all">Tutti i piani</option>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                </select>
                <select
                    value={suspendedFilter}
                    onChange={e => { setSuspendedFilter(e.target.value as typeof suspendedFilter); setPage(1); }}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                >
                    <option value="all">Tutti gli stati</option>
                    <option value="false">Attivi</option>
                    <option value="true">Sospesi</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 text-left">Utente</th>
                            <th className="px-4 py-3 text-left">Ruolo</th>
                            <th className="px-4 py-3 text-left">Piano</th>
                            <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('trips_count')}>
                                Viaggi <SortIcon col="trips_count" />
                            </th>
                            <th className="px-4 py-3 text-right">Post</th>
                            <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('created_at')}>
                                Registrato <SortIcon col="created_at" />
                            </th>
                            <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('last_sign_in_at')}>
                                Ultimo accesso <SortIcon col="last_sign_in_at" />
                            </th>
                            <th className="px-4 py-3 text-left">Stato</th>
                            <th className="px-4 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {loading
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}><td colSpan={9} className="px-4 py-4"><div className="h-4 bg-zinc-800 rounded animate-pulse" /></td></tr>
                              ))
                            : users.map(user => (
                                <tr key={user.id} className="hover:bg-zinc-800/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {user.avatarUrl
                                                ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                : <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">{user.displayName[0]?.toUpperCase()}</div>
                                            }
                                            <div>
                                                <div className="font-medium text-white">{user.displayName}</div>
                                                <div className="text-zinc-400 text-xs">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-violet-900/60 text-violet-300' : 'bg-zinc-700 text-zinc-300'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.plan === 'premium' ? 'bg-amber-900/60 text-amber-300' : 'bg-zinc-700 text-zinc-300'}`}>
                                            {user.plan}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-300">{user.tripsCount}</td>
                                    <td className="px-4 py-3 text-right text-zinc-300">{user.postsCount}</td>
                                    <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(user.createdAt).toLocaleDateString('it-IT')}</td>
                                    <td className="px-4 py-3 text-zinc-400 text-xs">
                                        {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('it-IT') : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.suspendedAt
                                            ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/60 text-red-300">Sospeso</span>
                                            : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-300">Attivo</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setSelectedUser(user)} className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors">Dettagli</button>
                                            <button onClick={() => setEditTarget(user)} className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors">Modifica</button>
                                            <button onClick={() => setImpersonateTarget(user)} className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors">Impersona</button>
                                            {user.suspendedAt
                                                ? <button onClick={() => handleUnsuspend(user.id)} className="px-2 py-1 text-xs text-green-400 hover:bg-zinc-700 rounded transition-colors">Riattiva</button>
                                                : <button onClick={() => setSuspendTarget(user)} className="px-2 py-1 text-xs text-amber-400 hover:bg-zinc-700 rounded transition-colors">Sospendi</button>
                                            }
                                            <button onClick={() => setDeleteTarget(user)} className="px-2 py-1 text-xs text-red-400 hover:bg-zinc-700 rounded transition-colors">Elimina</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-zinc-400">
                    <span>Pagina {page} di {totalPages}</span>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-zinc-800 disabled:opacity-30">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-zinc-800 disabled:opacity-30">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Dialogs & Drawers */}
            {selectedUser && <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} onAction={() => { setSelectedUser(null); loadUsers(); }} />}
            {impersonateTarget && <ImpersonateConfirmDialog user={impersonateTarget} onClose={() => setImpersonateTarget(null)} />}
            {suspendTarget && <SuspendDialog user={suspendTarget} onClose={() => setSuspendTarget(null)} onSuccess={() => { setSuspendTarget(null); loadUsers(); }} />}
            {deleteTarget && <DeleteUserDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={() => { setDeleteTarget(null); loadUsers(); }} />}
            {showCreate && <CreateUserDialog onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); loadUsers(); }} />}
            {editTarget && <EditUserDialog user={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { setEditTarget(null); loadUsers(); }} />}
        </div>
    );

    async function handleUnsuspend(userId: string) {
        await fetch(`/api/admin/users/${userId}/unsuspend`, { method: 'POST' });
        loadUsers();
    }
}
