'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { ExpenseCategory, Expense } from '@/lib/types';

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
    initialData?: Expense;
}

/**
 * Slide-up drawer for adding or editing an expense.
 */
export default function ExpenseDrawer({ tripId, open, onClose, onSaved, initialData }: ExpenseDrawerProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

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

    useEffect(() => {
        if (open) {
            if (initialData) {
                reset({
                    description: initialData.description,
                    amount: initialData.amount,
                    currency: initialData.currency,
                    category: initialData.category,
                    split: initialData.split,
                    date: initialData.date ?? undefined,
                    notes: initialData.notes ?? undefined,
                });
            } else {
                reset({
                    currency: 'EUR',
                    split: true,
                    category: 'food',
                    date: new Date().toISOString().split('T')[0],
                });
            }
        }
    }, [open, initialData]);

    const selectedCategory = watch('category');

    const onSubmit = async (values: FormValues) => {
        setSaving(true);
        setError(null);

        try {
            const url = isEditing
                ? `/api/expenses/${initialData!.id}`
                : `/api/trips/${tripId}/expenses`;

            const res = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
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
        <div className="relative z-50 aria-hidden={!open}">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal/Drawer Container */}
            <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                    
                    {/* Panel */}
                    <div className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-fade-in flex flex-col relative">
                        
                        <div className="p-6 sm:p-10">
                            {/* Handle (mobile only) */}
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />

                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{isEditing ? 'Modifica spesa' : 'Nuova spesa'}</h2>
                                <button onClick={onClose} className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {error && (
                                <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl text-sm font-bold tracking-wide">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Description */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                        Cosa hai acquistato? *
                                    </label>
                                    <input
                                        {...register('description')}
                                        placeholder="es. Cena romantica al molo, Biglietti treno..."
                                        className="w-full px-6 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                        autoComplete="off"
                                    />
                                    {errors.description && <p className="text-xs font-bold text-red-500 mt-2">{errors.description.message}</p>}
                                </div>

                                {/* Amount + Currency */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                            Importo *
                                        </label>
                                        <input
                                            {...register('amount')}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            className="w-full px-6 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-black text-2xl"
                                        />
                                        {errors.amount && <p className="text-xs font-bold text-red-500 mt-2">{errors.amount.message}</p>}
                                    </div>
                                    <div className="w-36">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                            Valuta
                                        </label>
                                        <select
                                            {...register('currency')}
                                            className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg appearance-none cursor-pointer text-center"
                                        >
                                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                        Categoria *
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {CATEGORIES.map(({ id, label, emoji }) => {
                                            const isSelected = selectedCategory === id;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setValue('category', id)}
                                                    className={`flex flex-col items-center justify-center p-5 rounded-3xl transition-all duration-300 ${
                                                        isSelected
                                                            ? 'bg-neutral-900 text-white shadow-panel scale-95 ring-4 ring-neutral-900 ring-offset-2'
                                                            : 'bg-neutral-50/80 text-neutral-600 hover:bg-neutral-100 hover:scale-[0.98]'
                                                    }`}
                                                >
                                                    <span className="text-4xl mb-3 block drop-shadow-sm">{emoji}</span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-neutral-500'}`}>{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Date & Split */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                            Data
                                        </label>
                                        <input
                                            {...register('date')}
                                            type="date"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="flex flex-col flex-1 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setValue('split', !watch('split'))}
                                            className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 h-[56px] ${
                                                watch('split') 
                                                ? 'bg-[#1a1a1a] shadow-panel' 
                                                : 'bg-neutral-50/80 hover:bg-neutral-100'
                                            }`}
                                        >
                                            <div className="text-left flex-1 min-w-0 mr-3">
                                                <p className={`text-[10px] font-black uppercase tracking-widest truncate ${watch('split') ? 'text-white' : 'text-neutral-500'}`}>Condivisa</p>
                                                <p className={`text-[10px] font-medium truncate ${watch('split') ? 'text-neutral-400' : 'text-neutral-400'}`}>Dividi 50%</p>
                                            </div>
                                            <div className={`w-12 h-6 shrink-0 rounded-full relative transition-colors duration-300 ${watch('split') ? 'bg-white/20' : 'bg-neutral-200'}`}>
                                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${watch('split') ? 'translate-x-6 shadow-sm' : ''}`} />
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                        Note (Opzionale)
                                    </label>
                                    <textarea
                                        {...register('notes')}
                                        rows={2}
                                        placeholder="Dettagli aggiuntivi da ricordare..."
                                        className="w-full px-6 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-200 transition-all font-medium resize-none text-sm"
                                    />
                                </div>

                                {/* Submit */}
                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {saving ? 'Salvataggio...' : isEditing ? 'Salva modifiche' : 'Conferma spesa'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
