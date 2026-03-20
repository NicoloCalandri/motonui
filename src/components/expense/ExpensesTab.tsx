'use client';

import { useEffect, useState } from 'react';
import type { Expense, ExpenseSummary, SplitResult } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { PlusCircle, Utensils, Car, Hotel, Ticket, ShoppingBag, MoreHorizontal, Download, Pencil, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import ExpenseDrawer from './ExpenseDrawer';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    food: Utensils, transport: Car, accommodation: Hotel,
    activity: Ticket, shopping: ShoppingBag, other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<string, string> = {
    food: '#C4622D', transport: '#7D9B76', accommodation: '#B88A4D',
    activity: '#5E7D59', shopping: '#DC7A50', other: '#9E908A',
};

const CATEGORY_LABELS: Record<string, string> = {
    food: 'Cibo', transport: 'Trasporti', accommodation: 'Alloggio',
    activity: 'Attività', shopping: 'Shopping', other: 'Altro',
};

interface ExpensesTabProps { tripId: string }

/**
 * Expenses tab: split list view and summary panel with charts.
 */
export default function ExpensesTab({ tripId }: ExpensesTabProps) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [summary, setSummary] = useState<ExpenseSummary | null>(null);
    const [split, setSplit] = useState<SplitResult | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [loading, setLoading] = useState(true);

    const openAdd = () => { setEditingExpense(null); setDrawerOpen(true); };
    const openEdit = (e: Expense) => { setEditingExpense(e); setDrawerOpen(true); };

    const deleteExpense = async (id: string) => {
        if (!confirm('Eliminare questa spesa?')) return;
        await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        fetchExpenses();
    };

    const fetchExpenses = () => {
        fetch(`/api/trips/${tripId}/expenses`)
            .then((r) => r.json())
            .then((data: { expenses: Expense[]; summary: ExpenseSummary; split: SplitResult }) => {
                setExpenses(data.expenses ?? []);
                setSummary(data.summary ?? null);
                setSplit(data.split ?? null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchExpenses(); }, [tripId]);

    const handleExportCSV = () => {
        const header = 'Data,Descrizione,Categoria,Importo,Valuta,EUR,Pagato da,Diviso';
        const rows = expenses.map((e) =>
            [e.date ?? '', e.description, CATEGORY_LABELS[e.category], e.amount, e.currency,
            (e.amount_eur ?? e.amount).toFixed(2), e.paid_by, e.split ? 'Sì' : 'No'].join(',')
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `spese-${tripId}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    // Prepare chart data
    const pieData = summary
        ? Object.entries(summary.by_category)
            .filter(([, v]) => v > 0)
            .map(([cat, val]) => ({ name: CATEGORY_LABELS[cat], value: val, color: CATEGORY_COLORS[cat] }))
        : [];

    const barData = summary
        ? Object.entries(summary.by_day)
            .slice(-14)
            .map(([date, val]) => ({
                date: format(new Date(date), 'd/M', { locale: it }),
                EUR: Math.round(val * 100) / 100,
            }))
        : [];

    // Group expenses by date
    const grouped: Record<string, Expense[]> = {};
    for (const exp of expenses) {
        const key = exp.date ?? 'Senza data';
        grouped[key] = [...(grouped[key] ?? []), exp];
    }

    return (
        <div className="flex flex-col md:flex-row gap-0 md:gap-0 h-full">
            {/* ─── Expense List (left) ─── */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl font-semibold text-ink-900">Spese</h2>
                    <div className="flex gap-2">
                        <button onClick={handleExportCSV} className="p-2 rounded-lg text-ink-400 hover:bg-sand-100">
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta-400 text-white rounded-xl text-sm font-medium hover:bg-terracotta-500 transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" /> Aggiungi
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="card p-3 h-14 animate-pulse bg-sand-100" />
                        ))}
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="text-center py-12 text-ink-400">
                        <p className="font-display text-lg mb-1">Nessuna spesa ancora</p>
                        <p className="text-sm">Inizia ad aggiungere le vostre spese</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(grouped).map(([date, exps]) => (
                            <div key={date}>
                                <p className="text-xs font-medium text-ink-400 mb-2 uppercase tracking-wide">
                                    {date !== 'Senza data'
                                        ? format(new Date(date), 'd MMMM', { locale: it })
                                        : 'Senza data'}
                                </p>
                                <div className="space-y-1.5">
                                    {exps.map((expense) => {
                                        const Icon = CATEGORY_ICONS[expense.category] ?? MoreHorizontal;
                                        return (
                                            <div key={expense.id} className="card p-3 flex items-center gap-3 group">
                                                <div
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ backgroundColor: `${CATEGORY_COLORS[expense.category]}20` }}
                                                >
                                                    <Icon className="w-4 h-4" style={{ color: CATEGORY_COLORS[expense.category] }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-ink-800 truncate">{expense.description}</p>
                                                    <p className="text-xs text-ink-400">
                                                        {CATEGORY_LABELS[expense.category]}
                                                        {expense.split && ' · Diviso'}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-semibold text-ink-900">
                                                        {expense.currency} {expense.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    {expense.amount_eur && expense.currency !== 'EUR' && (
                                                        <p className="text-xs text-ink-400">€{expense.amount_eur.toFixed(2)}</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        aria-label="Modifica spesa"
                                                        onClick={() => openEdit(expense)}
                                                        className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        aria-label="Elimina spesa"
                                                        onClick={() => deleteExpense(expense.id)}
                                                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Summary Panel (right) ─── */}
            {summary && (
                <div className="md:w-80 border-t md:border-t-0 md:border-l border-sand-200 p-4 md:p-6 space-y-6 bg-sand-50">
                    {/* Total */}
                    <div>
                        <p className="text-xs text-ink-400 uppercase tracking-wide mb-1">Totale spese</p>
                        <p className="font-display text-3xl font-bold text-ink-900">
                            €{summary.total_eur.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    {/* Balance */}
                    {split && (
                        <div className={`rounded-2xl p-4 ${split.is_even ? 'bg-sage-50 border border-sage-200' : 'bg-terracotta-50 border border-terracotta-200'}`}>
                            {split.is_even ? (
                                <p className="text-sage-600 font-medium text-sm">✓ Siete in pari!</p>
                            ) : (
                                split.settlements.map((s, i) => (
                                    <p key={i} className="text-terracotta-700 text-sm">
                                        Deve pagare <strong>€{s.amount_eur.toFixed(2)}</strong>
                                    </p>
                                ))
                            )}
                        </div>
                    )}

                    {/* Donut chart */}
                    {pieData.length > 0 && (
                        <div>
                            <p className="text-xs text-ink-400 uppercase tracking-wide mb-2">Per categoria</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: number) => [`€${val.toFixed(2)}`, '']} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1 mt-2">
                                {pieData.map((d) => (
                                    <div key={d.name} className="flex items-center gap-2 text-xs">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                                        <span className="text-ink-600 flex-1">{d.name}</span>
                                        <span className="text-ink-500">€{d.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bar chart */}
                    {barData.length > 0 && (
                        <div>
                            <p className="text-xs text-ink-400 uppercase tracking-wide mb-2">Spese giornaliere</p>
                            <ResponsiveContainer width="100%" height={100}>
                                <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Bar dataKey="EUR" fill="#C4622D" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Add / Edit Expense Drawer */}
            <ExpenseDrawer
                tripId={tripId}
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setEditingExpense(null); }}
                onSaved={fetchExpenses}
                initialData={editingExpense ?? undefined}
            />
        </div>
    );
}
