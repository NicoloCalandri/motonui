import { useState, useEffect, type BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { Leg } from '@motonui/shared-types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api-client';
import LocationSearch, { type LocationResult } from '../map/LocationSearch';
import CarrierSearch from './CarrierSearch';
import CurrencyCostField from './CurrencyCostField';
import BoardingPassField from './BoardingPassField';
import LegFlightSegments, { type FlightSegment } from './LegFlightSegments';

const defaultSegment = (): FlightSegment => ({ from_name: '', to_name: '' });

const LEG_TYPES = [
    { id: 'flight', label: 'Volo', emoji: '✈️' },
    { id: 'train', label: 'Treno', emoji: '🚆' },
    { id: 'car', label: 'Auto', emoji: '🚗' },
    { id: 'ferry', label: 'Traghetto', emoji: '⛴️' },
    { id: 'bus', label: 'Bus', emoji: '🚌' },
    { id: 'walk', label: 'A piedi', emoji: '🚶' },
    { id: 'other', label: 'Altro', emoji: '📍' },
];

const Schema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1, 'Origine richiesta').max(200),
    to_name: z.string().min(1, 'Destinazione richiesta').max(200),
    departure_date: z.string().optional(),
    departure_time: z.string().optional(),
    arrival_date: z.string().optional(),
    arrival_time: z.string().optional(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().default('EUR'),
    carrier: z.string().optional().nullable(),
    booking_ref: z.string().optional().nullable(),
    pnr: z.string().optional().nullable(),
    checkin_opens_at: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof Schema>;

interface LegDrawerProps {
    tripId: string;
    dayId?: string | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    dayDate?: string;
    initialData?: Leg;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
}

/**
 * Add/edit-leg (spostamento) drawer — the largest of the itinerary drawers.
 * Ported from src/components/trip/LegDrawer.tsx (648 lines).
 *
 * Split into four files to stay under docs/CLAUDE.md's 300-line-per-file
 * rule (the old file was not split at all): this file (form state, submit
 * logic, non-flight fields), `LegFlightSegments.tsx` (multi-stop airport
 * picker), `BoardingPassField.tsx` (upload/remove UI), and the shared
 * `CurrencyCostField.tsx`.
 *
 * Touchpoint changes from the old component:
 * - No `'use client'` directive.
 * - `Leg` type from `@motonui/shared-types` instead of `@/lib/types`.
 * - `LocationSearch`/`AirportSearch`(via `LegFlightSegments`)/`CarrierSearch`
 *   imported from their new paths.
 * - Raw `fetch(...)` + manual `res.ok` check -> `apiFetch(..., token)` with
 *   the auth token from `useAuth()`. The old component already wrapped its
 *   save in `try`/`catch`/`finally`, so this touchpoint carries no
 *   stuck-loading-state risk.
 * - Boarding-pass upload/remove: see `BoardingPassField.tsx`'s doc comment
 *   — it's rendered here only when both `isEditing` AND `dayId` are present
 *   (`{isEditing && dayId && <BoardingPassField ... />}`), whereas the old
 *   component rendered it whenever `isEditing` regardless of `dayId`, with
 *   its upload/remove handlers silently no-op-ing if `dayId` was missing
 *   (which happens for a top-level leg — e.g. edited from the Bookings tab,
 *   which doesn't pass a `dayId` prop to `LegDrawer` at all). This is a
 *   disclosed, intentional deviation, not a straight port: hiding a control
 *   that would otherwise silently fail is a minor behavior change, made
 *   necessary by `BoardingPassField`'s `dayId` prop being required (a
 *   string, not `string | undefined`) for its URL construction.
 */
export default function LegDrawer({ tripId, dayId, open, onClose, onSaved, dayDate, initialData, tripStartDate, tripEndDate }: LegDrawerProps) {
    const { session } = useAuth();
    const token = session?.access_token;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

    // Multi-segment state (flight only)
    const [segments, setSegments] = useState<FlightSegment[]>([defaultSegment()]);

    // Boarding pass state (upload/remove handled by BoardingPassField)
    const [boardingPassUrl, setBoardingPassUrl] = useState<string | null>(null);

    // Coordinates selected via geocoding (optional — map won't show if missing)
    const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
    // Separate state used as `initialValue` for LocationSearch so it resets when drawer opens
    const [fromInitial, setFromInitial] = useState('');
    const [toInitial, setToInitial] = useState('');

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: {
            type: 'flight',
            currency: 'EUR',
        },
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                reset({
                    type: initialData.type,
                    from_name: initialData.from_name,
                    to_name: initialData.to_name,
                    departure_date: initialData.departure_at ? initialData.departure_at.slice(0, 10) : (dayDate ?? undefined),
                    departure_time: initialData.departure_at ? initialData.departure_at.slice(11, 16) : undefined,
                    arrival_date: initialData.arrival_at ? initialData.arrival_at.slice(0, 10) : (dayDate ?? undefined),
                    arrival_time: initialData.arrival_at ? initialData.arrival_at.slice(11, 16) : undefined,
                    cost: initialData.cost ?? undefined,
                    currency: initialData.currency,
                    carrier: initialData.carrier ?? undefined,
                    booking_ref: initialData.booking_ref ?? undefined,
                    pnr: initialData.pnr ?? undefined,
                    checkin_opens_at: initialData.checkin_opens_at
                        ? initialData.checkin_opens_at.slice(0, 16)
                        : undefined,
                });
                setBoardingPassUrl(initialData.boarding_pass_url ?? null);
                setFromInitial(initialData.from_name);
                setToInitial(initialData.to_name);
                setFromCoords(
                    initialData.from_lat != null && initialData.from_lng != null
                        ? { lat: initialData.from_lat, lng: initialData.from_lng }
                        : null
                );
                setToCoords(
                    initialData.to_lat != null && initialData.to_lng != null
                        ? { lat: initialData.to_lat, lng: initialData.to_lng }
                        : null
                );
                // Editing: single segment pre-filled
                setSegments([{ from_name: initialData.from_name, to_name: initialData.to_name }]);
            } else {
                reset({ type: 'flight', currency: 'EUR', departure_date: dayDate ?? undefined, arrival_date: dayDate ?? undefined });
                setFromInitial('');
                setToInitial('');
                setFromCoords(null);
                setToCoords(null);
                setBoardingPassUrl(null);
                setSegments([defaultSegment()]);
            }
        }
    }, [open, initialData, dayDate, reset]);

    const selectedType = watch('type');

    const onSubmit = async (values: FormValues, event?: BaseSyntheticEvent) => {
        setSaving(true);
        setError(null);

        const nativeEvent = event?.nativeEvent as SubmitEvent | undefined;
        const submitter = nativeEvent?.submitter as HTMLButtonElement | null;
        const submitMode = submitter?.getAttribute('data-submit-mode') === 'add-another' ? 'add-another' : 'save';

        try {
            const depDate = values.departure_date ?? dayDate ?? initialData?.departure_at?.slice(0, 10);
            const arrDate = values.arrival_date ?? dayDate ?? initialData?.arrival_at?.slice(0, 10);
            const departure_at = (depDate && values.departure_time) ? `${depDate}T${values.departure_time}:00` : null;
            const arrival_at = (arrDate && values.arrival_time) ? `${arrDate}T${values.arrival_time}:00` : null;
            const checkin_opens_at = values.checkin_opens_at ? `${values.checkin_opens_at}:00` : null;

            // ── Multi-segment flight ──────────────────────────────────────────
            if (values.type === 'flight' && !isEditing && segments.length > 1) {
                const validSegments = segments.filter(s => s.from_name && s.to_name);
                if (validSegments.length < 2) {
                    setError('Compila almeno due tratte per un volo con scalo');
                    setSaving(false);
                    return;
                }

                const url = dayId
                    ? `/api/trips/${tripId}/days/${dayId}/legs`
                    : `/api/trips/${tripId}/legs`;

                await apiFetch(url, {
                    method: 'POST',
                    body: JSON.stringify({
                        ...values,
                        departure_at,
                        arrival_at,
                        checkin_opens_at,
                        segments: validSegments.map(s => ({
                            from_name: s.from_name,
                            to_name: s.to_name,
                            from_lat: s.from_lat ?? null,
                            from_lng: s.from_lng ?? null,
                            to_lat: s.to_lat ?? null,
                            to_lng: s.to_lng ?? null,
                        })),
                    }),
                }, token);
            } else {
                // ── Single leg (non-flight or editing or single segment) ─────
                const firstSeg = segments[0];
                const from_name = (values.type === 'flight' && firstSeg?.from_name) ? firstSeg.from_name : values.from_name;
                const to_name = (values.type === 'flight' && firstSeg?.to_name) ? firstSeg.to_name : values.to_name;

                const payload: Record<string, unknown> = {
                    ...values,
                    from_name,
                    to_name,
                    departure_at,
                    arrival_at,
                    checkin_opens_at,
                    from_lat: fromCoords?.lat ?? null,
                    from_lng: fromCoords?.lng ?? null,
                    to_lat: toCoords?.lat ?? null,
                    to_lng: toCoords?.lng ?? null,
                };

                let url = '';
                if (isEditing) {
                    url = `/api/trips/${tripId}/days/${dayId}/legs/${initialData!.id}`;
                } else {
                    url = dayId
                        ? `/api/trips/${tripId}/days/${dayId}/legs`
                        : `/api/trips/${tripId}/legs`;
                }

                await apiFetch(url, { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(payload) }, token);
            }

            onSaved();

            if (isEditing || submitMode === 'save') {
                reset();
                onClose();
                return;
            }

            reset({ type: values.type, currency: values.currency || 'EUR', departure_date: dayDate ?? undefined, arrival_date: dayDate ?? undefined });
            setFromInitial('');
            setToInitial('');
            setFromCoords(null);
            setToCoords(null);
            setBoardingPassUrl(null);
            setSegments([defaultSegment()]);
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
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{isEditing ? 'Modifica spostamento' : 'Nuovo spostamento'}</h2>
                                <button onClick={onClose} aria-label="Chiudi" className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-full transition-colors">
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
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Mezzo *</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {LEG_TYPES.map(({ id, label, emoji }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setValue('type', id as FormValues['type'])}
                                                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 ${selectedType === id
                                                    ? 'bg-neutral-900 text-white shadow-panel scale-95 ring-2 ring-neutral-900 ring-offset-2'
                                                    : 'bg-neutral-50/80 text-neutral-600 hover:bg-neutral-100'
                                                    }`}
                                            >
                                                <span className="text-2xl mb-1 block">{emoji}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Origin / Destination ── */}
                                {selectedType === 'flight' ? (
                                    <LegFlightSegments
                                        segments={segments}
                                        setSegments={setSegments}
                                        isEditing={isEditing}
                                        onFirstFromSelect={(r) => {
                                            setValue('from_name', r.label, { shouldValidate: true });
                                            setFromCoords({ lat: r.lat, lng: r.lng });
                                        }}
                                        onFirstFromText={(text) => setValue('from_name', text, { shouldValidate: true })}
                                        onLastToSelect={(r) => {
                                            setValue('to_name', r.label, { shouldValidate: true });
                                            setToCoords({ lat: r.lat, lng: r.lng });
                                        }}
                                        onLastToText={(text) => setValue('to_name', text, { shouldValidate: true })}
                                    />
                                ) : (
                                    /* Standard location search for non-flight types */
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Da *</label>
                                            <LocationSearch
                                                placeholder="es. Torino"
                                                initialValue={fromInitial}
                                                onSelect={(r: LocationResult) => {
                                                    setValue('from_name', r.name, { shouldValidate: true });
                                                    setFromCoords({ lat: r.lat, lng: r.lng });
                                                }}
                                                onTextChange={(text) => {
                                                    setValue('from_name', text, { shouldValidate: true });
                                                    if (!text) setFromCoords(null);
                                                }}
                                            />
                                            {errors.from_name && (
                                                <p className="mt-1 text-xs text-red-500">{errors.from_name.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">A *</label>
                                            <LocationSearch
                                                placeholder="es. San Paolo del Brasile"
                                                initialValue={toInitial}
                                                onSelect={(r: LocationResult) => {
                                                    setValue('to_name', r.name, { shouldValidate: true });
                                                    setToCoords({ lat: r.lat, lng: r.lng });
                                                }}
                                                onTextChange={(text) => {
                                                    setValue('to_name', text, { shouldValidate: true });
                                                    if (!text) setToCoords(null);
                                                }}
                                            />
                                            {errors.to_name && (
                                                <p className="mt-1 text-xs text-red-500">{errors.to_name.message}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Carrier */}
                                {selectedType !== 'walk' && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Compagnia / Vettore</label>
                                        <CarrierSearch
                                            legType={selectedType}
                                            initialValue={watch('carrier') ?? ''}
                                            onChange={(val) => setValue('carrier', val || null)}
                                        />
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Partenza</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                {...register('departure_date')}
                                                type="date"
                                                min={tripStartDate || undefined}
                                                max={tripEndDate || undefined}
                                                className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                            />
                                            <input
                                                {...register('departure_time')}
                                                type="time"
                                                className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Arrivo</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                {...register('arrival_date')}
                                                type="date"
                                                min={watch('departure_date') || tripStartDate || undefined}
                                                max={tripEndDate || undefined}
                                                className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                            />
                                            <input
                                                {...register('arrival_time')}
                                                type="time"
                                                className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <CurrencyCostField
                                    label="Costo stimato"
                                    currencyProps={register('currency')}
                                    costProps={register('cost')}
                                />

                                {/* Booking reference (all non-walk types) */}
                                {selectedType !== 'walk' && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Numero prenotazione</label>
                                        <input
                                            {...register('booking_ref')}
                                            placeholder="es. ABC123456"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                )}

                                {/* Flight-only fields: PNR, check-in time, boarding pass */}
                                {selectedType === 'flight' && (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">PNR (codice volo)</label>
                                            <input
                                                {...register('pnr')}
                                                placeholder="es. XKQM5A"
                                                className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-mono font-bold tracking-widest uppercase"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Apertura check-in online</label>
                                            <input
                                                {...register('checkin_opens_at')}
                                                type="datetime-local"
                                                className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                            />
                                        </div>
                                        {isEditing && dayId && (
                                            <BoardingPassField
                                                tripId={tripId}
                                                dayId={dayId}
                                                legId={initialData!.id}
                                                boardingPassUrl={boardingPassUrl}
                                                onBoardingPassChange={setBoardingPassUrl}
                                            />
                                        )}
                                    </>
                                )}

                                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="submit"
                                        data-submit-mode="save"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {saving ? 'Salvataggio...' : isEditing ? 'Salva modifiche' : 'Aggiungi spostamento'}
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
