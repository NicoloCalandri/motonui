'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';

const Schema = z.object({
    date: z.string().min(1, 'Inserisci una data valida').regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
    title: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof Schema>;

interface DayDrawerProps {
    tripId: string;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
}

export default function DayDrawer({ tripId, open, onClose, onSaved, tripStartDate, tripEndDate }: DayDrawerProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
        },
    });

    const onSubmit = async (values: FormValues) => {
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/trips/${tripId}/days`, {
                method: 'POST',
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
            {/* Backdrop */}
            <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Modal Container */}
            <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                    
                    {/* Panel */}
                    <div className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl animate-slide-up sm:animate-fade-in flex flex-col relative">
                        
                        <div className="p-6 sm:p-10">
                            {/* Handle (mobile only) */}
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />

                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Nuovo giorno</h2>
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
                                {/* Date */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                        Data *
                                    </label>
                                    <input
                                        {...register('date')}
                                        type="date"
                                        min={tripStartDate || undefined}
                                        max={tripEndDate || undefined}
                                        className="w-full px-6 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                    {errors.date && <p className="text-xs font-bold text-red-500 mt-2">{errors.date.message}</p>}
                                </div>

                                {/* Title */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                        Titolo o Tema (Opzionale)
                                    </label>
                                    <input
                                        {...register('title')}
                                        placeholder="es. Arrivo a destinazione, Tour in barca..."
                                        className="w-full px-6 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                        autoComplete="off"
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
                                        {saving ? 'Aggiunta in corso...' : 'Aggiungi all\'itinerario'}
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
