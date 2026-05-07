'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLogEntry {
    id: string;
    admin_id: string;
    admin_email?: string;
    action: string;
    target_user_id: string | null;
    target_email?: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
}

interface AuditLogResponse {
    data: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
}

const ACTION_OPTIONS = [
    'suspend',
    'unsuspend',
    'impersonate',
    'delete',
    'view_profile',
    'update_user',
    'premium_update',
];

const ACTION_COLORS: Record<string, string> = {
    suspend: 'bg-red-100 text-red-700',
    unsuspend: 'bg-green-100 text-green-700',
    impersonate: 'bg-amber-100 text-amber-700',
    delete: 'bg-red-200 text-red-800',
    view_profile: 'bg-zinc-100 text-zinc-600',
    update_user: 'bg-sky-100 text-sky-700',
    premium_update: 'bg-amber-100 text-amber-700',
};

export default function AuditLogPage() {
    const [data, setData] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [action, setAction] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const pageSize = 25;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
            });
            if (action) params.set('action', action);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const res = await fetch(`/api/admin/audit-log?${params}`);
            if (!res.ok) throw new Error('Fetch failed');
            const json: AuditLogResponse = await res.json();
            setData(json.data ?? []);
            setTotal(json.total ?? 0);
        } catch {
            // keep existing data
        } finally {
            setLoading(false);
        }
    }, [page, action, dateFrom, dateTo]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExportCsv = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams({ export: 'csv' });
            if (action) params.set('action', action);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const res = await fetch(`/api/admin/audit-log?${params}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Audit Log</h1>
                    <p className="text-sm text-zinc-400 mt-1">{total} azioni registrate</p>
                </div>
                <button
                    onClick={handleExportCsv}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    {exporting ? 'Esportazione...' : 'Esporta CSV'}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={action}
                    onChange={e => { setAction(e.target.value); setPage(1); }}
                    title="Filtra per azione"
                    aria-label="Filtra per azione"
                    className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-zinc-500 focus:outline-none"
                >
                    <option value="">Tutte le azioni</option>
                    {ACTION_OPTIONS.map(a => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-400">Dal</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                        title="Data inizio"
                        aria-label="Data inizio"
                        className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-zinc-500 focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-400">Al</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setPage(1); }}
                        title="Data fine"
                        aria-label="Data fine"
                        className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-zinc-500 focus:outline-none"
                    />
                </div>

                {(action || dateFrom || dateTo) && (
                    <button
                        onClick={() => { setAction(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                        className="text-sm text-zinc-400 hover:text-zinc-100 px-3 py-2 transition-colors"
                    >
                        Azzera filtri
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-zinc-400">Caricamento...</div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-zinc-400">Nessun risultato</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-700">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Timestamp</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Azione</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Utente target</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dettagli</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-700/50">
                            {data.map(entry => (
                                <tr key={entry.id} className="hover:bg-zinc-700/30 transition-colors">
                                    <td className="px-4 py-3 text-zinc-300 whitespace-nowrap font-mono text-xs">
                                        {new Date(entry.created_at).toLocaleString('it-IT')}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-300 text-xs">
                                        {entry.admin_email ?? entry.admin_id.slice(0, 8) + '…'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[entry.action] ?? 'bg-zinc-700 text-zinc-200'}`}>
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-300 text-xs">
                                        {entry.target_email ?? (entry.target_user_id ? entry.target_user_id.slice(0, 8) + '…' : '—')}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono max-w-xs truncate">
                                        {entry.details ? JSON.stringify(entry.details) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                        Pagina {page} di {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            title="Pagina precedente"
                            aria-label="Pagina precedente"
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            title="Pagina successiva"
                            aria-label="Pagina successiva"
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-40 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
