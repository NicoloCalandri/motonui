import { useState, useEffect, type BaseSyntheticEvent } from 'react';
import { useDialogA11y } from '../ui/use-dialog-a11y';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { Activity } from '@motonui/shared-types';
import { useAuth } from '../../lib/auth-context';
import { emptyToNull } from '../../lib/form-payload';
import { apiFetch } from '../../lib/api-client';
import CurrencyCostField from '../trip/CurrencyCostField';

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
    dayContext?: {
        id: string;
        date: string;
    };
}

/**
 * Add/edit-activity drawer. Ported from
 * src/components/booking/ActivityDrawer.tsx.
 *
 * Touchpoint changes from the old component:
 * - No `'use client'` directive; `Activity` from `@motonui/shared-types`.
 * - Raw `fetch(...)` + manual `res.ok`/`res.json()` check -> `apiFetch(...,
 *   token)` with the auth token from `useAuth()`, matching
 *   LegDrawer/AccommodationDrawer. The old component already wrapped its
 *   save in `try`/`catch`/`finally`, so this carries no stuck-loading-state
 *   risk — just the fetch call itself swapped.
 * - The currency-select + cost-input block reuses the existing
 *   `CurrencyCostField` (shared with LegDrawer/AccommodationDrawer) instead
 *   of duplicating that markup a third time — byte-for-byte identical old
 *   markup, not new behavior.
 */
export default function ActivityDrawer({ tripId, open, onClose, onSaved, initialData, tripStartDate, tripEndDate, dayContext }: ActivityDrawerProps) {
    const { session } = useAuth();
    const token = session?.access_token;
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
                reset({
                    currency: 'EUR',
                    type: 'tour',
                    date: dayContext?.date ?? undefined,
                });
            }
        }
    }, [open, initialData, reset, dayContext]);

    const onSubmit = async (values: FormValues, event?: BaseSyntheticEvent) => {
        setSaving(true);
        setError(null);

        const nativeEvent = event?.nativeEvent as SubmitEvent | undefined;
        const submitter = nativeEvent?.submitter as HTMLButtonElement | null;
        const submitMode = submitter?.getAttribute('data-submit-mode') === 'add-another' ? 'add-another' : 'save';

        try {
            const url = isEditing
                ? `/api/trips/${tripId}/activities/${initialData!.id}`
                : `/api/trips/${tripId}/activities`;

            const payload = {
                ...emptyToNull(values),
                day_id: dayContext?.id ?? initialData?.day_id ?? null,
            };

            await apiFetch(url, { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(payload) }, token);

            onSaved();

            if (isEditing || submitMode === 'save') {
                reset();
                onClose();
                return;
            }

            reset({
                currency: values.currency || 'EUR',
                type: values.type,
                date: dayContext?.date ?? undefined,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ops! Qualcosa è andato storto 🏝️');
        } finally {
            setSaving(false);
        }
    };

    const panelRef = useDialogA11y<HTMLDivElement>(open, onClose);

    if (!open) return null;

    return (
        <div className="relative z-50">
            <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="activity-drawer-title" tabIndex={-1} className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl animate-slide-up sm:animate-fade-in flex flex-col relative max-h-[90vh]">
                        <div className="p-6 sm:p-10 overflow-y-auto">
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />
                            <div className="flex items-center justify-between mb-8">
                                <h2 id="activity-drawer-title" className="text-3xl font-bold tracking-tight text-neutral-900">
                                    {isEditing ? 'Modifica attività' : 'Nuova attività'}
                                </h2>
                                <button type="button" onClick={onClose} aria-label="Chiudi" className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-full transition-colors">
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
                                    <label htmlFor="activity-name" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Nome Attività *</label>
                                    <input
                                        id="activity-name"
                                        {...register('name')}
                                        placeholder="es. Tour del Colosseo"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                                </div>

                                <div>
                                    <label htmlFor="activity-address" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Indirizzo / Luogo</label>
                                    <input
                                        id="activity-address"
                                        {...register('address')}
                                        placeholder="es. Piazza del Colosseo, 1"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="activity-date" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Data</label>
                                        <input
                                            id="activity-date"
                                            {...register('date')}
                                            type="date"
                                            min={tripStartDate || undefined}
                                            max={tripEndDate || undefined}
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="activity-time" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Orario</label>
                                        <input
                                            id="activity-time"
                                            {...register('time')}
                                            type="time"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="activity-duration-min" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Durata (minuti)</label>
                                    <input
                                        id="activity-duration-min"
                                        {...register('duration_min')}
                                        type="number"
                                        min="1"
                                        placeholder="es. 120"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                    />
                                </div>

                                <CurrencyCostField
                                    label="Costo biglietto"
                                    currencyProps={register('currency')}
                                    costProps={register('cost')}
                                />

                                <div>
                                    <label htmlFor="activity-booking-ref" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Codice prenotazione</label>
                                    <input
                                        id="activity-booking-ref"
                                        {...register('booking_ref')}
                                        placeholder="es. TKT-98765"
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="activity-notes" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Note</label>
                                    <textarea
                                        id="activity-notes"
                                        {...register('notes')}
                                        rows={2}
                                        placeholder="es. portare scarpe comode..."
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold resize-none"
                                    />
                                </div>

                                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="submit"
                                        data-submit-mode="save"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {saving ? 'Salvataggio...' : isEditing ? 'Salva modifiche' : 'Aggiungi attività'}
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
