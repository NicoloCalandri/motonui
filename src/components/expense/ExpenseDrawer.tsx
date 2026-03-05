'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { ExpenseCategory } from '@/lib/types';

const CATEGORIES: { id: ExpenseCategory; label: string; emoji: string }[] = [
    { id: 'food', label: 'Cibo', emoji: '🍕' },
    { id: 'transport', label: 'Trasporti', emoji: '✈️' },
    { id: 'accommodation', label: 'Alloggio', emoji: '🏨' },
    { id: 'activity', label: 'Attività', emoji: '🎭' },
    { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
    { id: 'other', label: 'Altro', emoji: '💳' },
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK'];

const Schema = z.object({
    description: z.string().min(1, 'Inserisci una descrizione'),
    amount: z.coerce.number().positive('Importo non valido'),
    currency: z.string().length(3),
    category: z.enum(['food', 'transport', 'accommodation', 'activity', 'shopping', 'other']),
    split: z.boolean(),
    date: z.string().optional(),
    notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof Schema>;

interface ExpenseDrawerProps {
    tripId: string;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Slide-up drawer for adding a new expense.
 */
export default function ExpenseDrawer({ tripId, open, onClose, onSaved }: ExpenseDrawerProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: {
            currency: 'EUR',
            split: true,
            category: 'food',
            date: new Date().toISOString().split('T')[0],
        },
    });

    const selectedCategory = watch('category');

    const onSubmit = async (values: FormValues) => {
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/trips/${tripId}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const data: { error?: string } = await res.json();
                throw new Error(data.error ?? 'Errore nel salvataggio');
            }

            reset();
            onClose();
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ops! Qualcosa è andato storto 🏝️');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed bottom-0 inset-x-0 z-50 bg-sand-50 rounded-t-3xl shadow-drawer max-h-[90vh] overflow-y-auto animate-slide-up">
                <div className="p-5">
                    {/* Handle */}
                    <div className="w-12 h-1 bg-sand-300 rounded-full mx-auto mb-5" />

                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-display text-xl font-semibold text-ink-900">Nuova spesa</h2>
                        <button onClick={onClose} className="p-2 hover:bg-sand-100 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-ink-400" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-terracotta-50 border border-terracotta-200 rounded-xl text-terracotta-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Descrizione *</label>
                            <input
                                {...register('description')}
                                placeholder="es. Cena al ristorante"
                                className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                            />
                            {errors.description && <p className="text-xs text-terracotta-500 mt-1">{errors.description.message}</p>}
                        </div>

                        {/* Amount + Currency */}
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-ink-700 mb-1">Importo *</label>
                                <input
                                    {...register('amount')}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                                />
                                {errors.amount && <p className="text-xs text-terracotta-500 mt-1">{errors.amount.message}</p>}
                            </div>
                            <div className="w-28">
                                <label className="block text-sm font-medium text-ink-700 mb-1">Valuta</label>
                                <select
                                    {...register('currency')}
                                    className="w-full px-3 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                                >
                                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-2">Categoria *</label>
                            <div className="grid grid-cols-3 gap-2">
                                {CATEGORIES.map(({ id, label, emoji }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setValue('category', id)}
                                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-medium transition-colors ${selectedCategory === id
                                                ? 'border-terracotta-400 bg-terracotta-50 text-terracotta-700'
                                                : 'border-sand-200 bg-white text-ink-600 hover:border-sand-300'
                                            }`}
                                    >
                                        <span className="text-2xl leading-none">{emoji}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Data</label>
                            <input
                                {...register('date')}
                                type="date"
                                className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                            />
                        </div>

                        {/* Split toggle */}
                        <div className="flex items-center justify-between p-3 bg-sand-100 rounded-xl">
                            <div>
                                <p className="text-sm font-medium text-ink-800">Spesa condivisa</p>
                                <p className="text-xs text-ink-400">Dividi equamente con il partner</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setValue('split', !watch('split'))}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${watch('split') ? 'bg-terracotta-400' : 'bg-sand-300'
                                    }`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${watch('split') ? 'translate-x-5' : 'translate-x-0.5'
                                    }`} />
                            </button>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Note (opzionale)</label>
                            <textarea
                                {...register('notes')}
                                rows={2}
                                placeholder="Note aggiuntive..."
                                className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400/60 resize-none"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ink-900 hover:bg-ink-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {saving ? 'Salvataggio...' : 'Aggiungi spesa'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
