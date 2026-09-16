'use client';

import { useState, useEffect, type BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { Accommodation } from '@/lib/types';

const Schema = z.object({
    name: z.string().min(1, 'Nome struttura richiesto').max(200),
    address: z.string().optional(),
    check_in: z.string().optional(),
    check_out: z.string().optional(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().default('EUR'),
    booking_ref: z.string().optional().nullable(),
    payment_deadline: z.string().optional().nullable(),
    cancellation_deadline: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof Schema>;

interface AccommodationDrawerProps {
    tripId: string;
    dayId?: string | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    dayDate?: string;
    initialData?: Accommodation;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
}

export default function AccommodationDrawer({ tripId, dayId, open, onClose, onSaved, dayDate, initialData, tripStartDate, tripEndDate }: AccommodationDrawerProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: {
            currency: 'EUR',
            check_in: dayDate || undefined,
            check_out: dayDate || undefined,
        },
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                reset({
                    name: initialData.name,
                    address: initialData.address ?? undefined,
                    check_in: initialData.check_in ?? undefined,
                    check_out: initialData.check_out ?? undefined,
                    cost: initialData.cost ?? undefined,
                    currency: initialData.currency,
                    booking_ref: initialData.booking_ref ?? undefined,
                    payment_deadline: initialData.payment_deadline ?? undefined,
                    cancellation_deadline: initialData.cancellation_deadline ?? undefined,
                });
            } else {
                reset({ currency: 'EUR', check_in: dayDate || undefined, check_out: dayDate || undefined });
            }
        }
    }, [open, initialData]);

    const onSubmit = async (values: FormValues, event?: BaseSyntheticEvent) => {
        setSaving(true);
        setError(null);

        const nativeEvent = event?.nativeEvent as SubmitEvent | undefined;
        const submitter = nativeEvent?.submitter as HTMLButtonElement | null;
        const submitMode = submitter?.getAttribute('data-submit-mode') === 'add-another' ? 'add-another' : 'save';

        try {
            let url = '';
            if (isEditing) {
                url = `/api/trips/${tripId}/days/${dayId}/accommodations/${initialData!.id}`;
            } else {
                url = dayId 
                    ? `/api/trips/${tripId}/days/${dayId}/accommodations` 
                    : `/api/trips/${tripId}/accommodations`;
            }

            const res = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Errore nel salvataggio');
            }

            onSaved();

            if (isEditing || submitMode === 'save') {
                reset();
                onClose();
                return;
            }

            reset({ currency: values.currency || 'EUR', check_in: dayDate || undefined, check_out: dayDate || undefined });
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
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{isEditing ? 'Modifica alloggio' : 'Nuovo alloggio'}</h2>
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
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Nome Struttura *</label>
                                    <input
                                        {...register('name')}
                                        placeholder="es. Grand Hotel Plaza"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Indirizzo o Zona</label>
                                    <input
                                        {...register('address')}
                                        placeholder="es. Via del Corso, 1"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Check-in (Data)</label>
                                        <input
                                            {...register('check_in')}
                                            type="date"
                                            min={tripStartDate || undefined}
                                            max={tripEndDate || undefined}
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Check-out (Data)</label>
                                        <input
                                            {...register('check_out')}
                                            type="date"
                                            min={watch('check_in') || tripStartDate || undefined}
                                            max={tripEndDate || undefined}
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Costo stimato</label>
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
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Codice prenotazione (es. Booking.com)</label>
                                    <input
                                        {...register('booking_ref')}
                                        placeholder="es. 4082.563.821"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Scadenza pagamento</label>
                                        <input
                                            {...register('payment_deadline')}
                                            type="date"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Cancellazione gratuita entro</label>
                                        <input
                                            {...register('cancellation_deadline')}
                                            type="date"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="submit"
                                        data-submit-mode="save"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {saving ? 'Salvataggio...' : isEditing ? 'Salva modifiche' : 'Aggiungi alloggio'}
                                    </button>
                                    {!isEditing && (
                                        <button
                                            type="submit"
                                            data-submit-mode="add-another"
                                            disabled={saving}
                                            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-[24px] font-bold text-lg transition-all duration-300 active:scale-95 disabled:opacity-50"
                                        >
                                            Salva e aggiungi un altro
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
