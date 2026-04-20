'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { Activity } from '@/lib/types';

const Schema = z.object({
    name: z.string().min(1, 'Nome attività richiesto').max(200),
    type: z.enum(['museum', 'tour', 'excursion', 'show', 'sport', 'other']).default('tour'),
    address: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    time: z.string().optional().nullable(),
    duration_min: z.coerce.number().int().min(1).optional().nullable(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().default('EUR'),
    booking_ref: z.string().optional().nullable(),
    ticket_url: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof Schema>;

const ACTIVITY_TYPES = [
    { value: 'museum', label: 'Museo', emoji: '🏛️' },
    { value: 'tour', label: 'Tour', emoji: '🚶' },
    { value: 'excursion', label: 'Escursione', emoji: '🥾' },
    { value: 'show', label: 'Spettacolo', emoji: '🎭' },
    { value: 'sport', label: 'Sport', emoji: '⛷️' },
    { value: 'other', label: 'Altro', emoji: '📍' },
] as const;

interface ActivityDrawerProps {
    tripId: string;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    initialData?: Activity;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
}

export default function ActivityDrawer({ tripId, open, onClose, onSaved, initialData, tripStartDate, tripEndDate }: ActivityDrawerProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: { currency: 'EUR', type: 'tour' },
    });

    const selectedType = watch('type');

    useEffect(() => {
        if (open) {
            if (initialData) {
                reset({
                    name: initialData.name,
                    type: initialData.type as FormValues['type'],
                    address: initialData.address ?? undefined,
                    date: initialData.date ?? undefined,
                    time: initialData.time ?? undefined,
                    duration_min: initialData.duration_min ?? undefined,
                    cost: initialData.cost ?? undefined,
                    currency: initialData.currency,
                    booking_ref: initialData.booking_ref ?? undefined,
                    ticket_url: initialData.ticket_url ?? undefined,
                    notes: initialData.notes ?? undefined,
                });
            } else {
                reset({ currency: 'EUR', type: 'tour' });
            }
        }
    }, [open, initialData, reset]);

    const onSubmit = async (values: FormValues) => {
        setSaving(true);
        setError(null);

        try {
            const url = isEditing
                ? `/api/trips/${tripId}/activities/${initialData!.id}`
                : `/api/trips/${tripId}/activities`;

            const res = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Errore nel salvataggio');
            }

            reset();
            onClose();
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore imprevisto');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="relative z-50">
            <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                    <div className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl animate-slide-up sm:animate-fade-in flex flex-col relative max-h-[90vh]">
                        <div className="p-6 sm:p-10 overflow-y-auto">
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
                                    {isEditing ? 'Modifica attività' : 'Nuova attività'}
                                </h2>
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
                                {/* Type selector */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Tipo Attività</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ACTIVITY_TYPES.map(({ value, label, emoji }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setValue('type', value)}
                                                className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                                                    selectedType === value
                                                        ? 'bg-neutral-900 text-white shadow-panel'
                                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                                }`}
                                            >
                                                {emoji} {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Nome Attività *</label>
                                    <input
                                        {...register('name')}
                                        placeholder="es. Tour del Colosseo"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Indirizzo / Luogo</label>
                                    <input
                                        {...register('address')}
                                        placeholder="es. Piazza del Colosseo, 1"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Data</label>
                                        <input
                                            {...register('date')}
                                            type="date"
                                            min={tripStartDate || undefined}
                                            max={tripEndDate || undefined}
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Orario</label>
                                        <input
                                            {...register('time')}
                                            type="time"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Durata (minuti)</label>
                                    <input
                                        {...register('duration_min')}
                                        type="number"
                                        min="1"
                                        placeholder="es. 120"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Costo biglietto</label>
                                    <div className="flex gap-3">
                                        <select
                                            {...register('currency')}
                                            className="px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-sm w-28 flex-shrink-0"
                                        >
                                            <option value="EUR">EUR €</option>
                                            <option value="USD">USD $</option>
                                            <option value="GBP">GBP £</option>
                                            <option value="BRL">BRL R$</option>
                                            <option value="JPY">JPY ¥</option>
                                            <option value="CHF">CHF</option>
                                            <option value="AUD">AUD</option>
                                            <option value="CAD">CAD</option>
                                            <option value="THB">THB ฿</option>
                                            <option value="MXN">MXN</option>
                                        </select>
                                        <input
                                            {...register('cost')}
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="flex-1 px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Codice prenotazione</label>
                                    <input
                                        {...register('booking_ref')}
                                        placeholder="es. TKT-98765"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Note</label>
                                    <textarea
                                        {...register('notes')}
                                        rows={2}
                                        placeholder="es. portare scarpe comode..."
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold resize-none"
                                    />
                                </div>

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {saving ? 'Salvataggio...' : isEditing ? 'Salva modifiche' : 'Aggiungi attività'}
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
