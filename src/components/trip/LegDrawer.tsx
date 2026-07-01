'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Upload, Ticket, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { Leg } from '@/lib/types';
import LocationSearch, { type LocationResult } from '@/components/map/LocationSearch';
import AirportSearch, { type AirportResult } from '@/components/trip/AirportSearch';
import CarrierSearch from '@/components/trip/CarrierSearch';

// ─── Flight segment (multi-stop support) ─────────────────────────────────────
interface FlightSegment {
    from_name: string;  // e.g. "TRN — Torino"
    to_name: string;
    from_lat?: number | null;
    from_lng?: number | null;
    to_lat?: number | null;
    to_lng?: number | null;
}

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

export default function LegDrawer({ tripId, dayId, open, onClose, onSaved, dayDate, initialData, tripStartDate, tripEndDate }: LegDrawerProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

    // Multi-segment state (flight only)
    const [segments, setSegments] = useState<FlightSegment[]>([defaultSegment()]);

    // Boarding pass upload state
    const [boardingPassUrl, setBoardingPassUrl] = useState<string | null>(null);
    const [uploadingBoardingPass, setUploadingBoardingPass] = useState(false);

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
    }, [open, initialData]);

    const selectedType = watch('type');

    const handleBoardingPassUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !initialData || !dayId) return;
        setUploadingBoardingPass(true);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch(
                `/api/trips/${tripId}/days/${dayId}/legs/${initialData.id}/boarding-pass`,
                { method: 'POST', body: form }
            );
            if (res.ok) {
                const data = await res.json();
                setBoardingPassUrl(data.boarding_pass_url ?? null);
            }
        } finally {
            setUploadingBoardingPass(false);
            e.target.value = '';
        }
    };

    const handleBoardingPassRemove = async () => {
        if (!initialData || !dayId) return;
        await fetch(
            `/api/trips/${tripId}/days/${dayId}/legs/${initialData.id}/boarding-pass`,
            { method: 'DELETE' }
        );
        setBoardingPassUrl(null);
    };

    const onSubmit = async (values: FormValues) => {
        setSaving(true);
        setError(null);

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
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error ?? 'Errore nel salvataggio');
                }
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

                const res = await fetch(url, {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error ?? 'Errore nel salvataggio');
                }
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
                                    /* Multi-segment airport picker */
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Tratte *</label>
                                            {!isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSegments(prev => [...prev, { from_name: prev[prev.length - 1]?.to_name ?? '', to_name: '' }])}
                                                    className="flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Aggiungi scalo
                                                </button>
                                            )}
                                        </div>

                                        {segments.map((seg, idx) => (
                                            <div key={idx} className="relative bg-neutral-50 rounded-2xl p-3 space-y-2">
                                                {segments.length > 1 && (
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                                            {idx === 0 ? 'Volo 1' : `Scalo ${idx} → Volo ${idx + 1}`}
                                                        </span>
                                                        {!isEditing && segments.length > 1 && (
                                                            <button
                                                                type="button"
                                                                aria-label="Rimuovi tratta"
                                                                onClick={() => setSegments(prev => prev.filter((_, i) => i !== idx))}
                                                                className="text-neutral-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <AirportSearch
                                                    placeholder="Da — codice IATA o città"
                                                    initialValue={seg.from_name}
                                                    onSelect={(r: AirportResult) => {
                                                        setSegments(prev => prev.map((s, i) =>
                                                            i === idx ? { ...s, from_name: r.label, from_lat: r.lat, from_lng: r.lng } : s
                                                        ));
                                                        if (idx === 0) {
                                                            setValue('from_name', r.label, { shouldValidate: true });
                                                            setFromCoords({ lat: r.lat, lng: r.lng });
                                                        }
                                                    }}
                                                    onTextChange={(text) => {
                                                        setSegments(prev => prev.map((s, i) =>
                                                            i === idx ? { ...s, from_name: text } : s
                                                        ));
                                                        if (idx === 0) setValue('from_name', text, { shouldValidate: true });
                                                    }}
                                                />
                                                <div className="flex items-center gap-2 px-1">
                                                    <ArrowRight className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                                                </div>
                                                <AirportSearch
                                                    placeholder="A — codice IATA o città"
                                                    initialValue={seg.to_name}
                                                    onSelect={(r: AirportResult) => {
                                                        setSegments(prev => {
                                                            const updated = prev.map((s, i) =>
                                                                i === idx ? { ...s, to_name: r.label, to_lat: r.lat, to_lng: r.lng } : s
                                                            );
                                                            // Auto-fill next segment's "from" if blank
                                                            if (idx + 1 < updated.length && !updated[idx + 1].from_name) {
                                                                updated[idx + 1] = { ...updated[idx + 1], from_name: r.label, from_lat: r.lat, from_lng: r.lng };
                                                            }
                                                            return updated;
                                                        });
                                                        if (idx === segments.length - 1) {
                                                            setValue('to_name', r.label, { shouldValidate: true });
                                                            setToCoords({ lat: r.lat, lng: r.lng });
                                                        }
                                                    }}
                                                    onTextChange={(text) => {
                                                        setSegments(prev => prev.map((s, i) =>
                                                            i === idx ? { ...s, to_name: text } : s
                                                        ));
                                                        if (idx === segments.length - 1) setValue('to_name', text, { shouldValidate: true });
                                                    }}
                                                />
                                            </div>
                                        ))}

                                        {/* Show the overall route summary when multi-segment */}
                                        {segments.length > 1 && segments[0].from_name && segments[segments.length - 1].to_name && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 rounded-xl text-white text-xs font-bold">
                                                <span className="font-mono">{segments[0].from_name.split(' — ')[0]}</span>
                                                <ArrowRight className="w-3 h-3 opacity-60 flex-shrink-0" />
                                                {segments.slice(1, -1).map((s, i) => (
                                                    <span key={i} className="flex items-center gap-2">
                                                        <span className="font-mono opacity-60">{s.from_name.split(' — ')[0]}</span>
                                                        <ArrowRight className="w-3 h-3 opacity-60 flex-shrink-0" />
                                                    </span>
                                                ))}
                                                <span className="font-mono">{segments[segments.length - 1].to_name.split(' — ')[0]}</span>
                                                <span className="ml-auto opacity-40 font-normal">{segments.length} voli</span>
                                            </div>
                                        )}
                                    </div>
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
                                        {isEditing && (
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Carta d&apos;imbarco</label>
                                                {boardingPassUrl ? (
                                                    <div className="flex items-center gap-3 p-4 bg-sage-50 rounded-2xl">
                                                        <Ticket className="w-5 h-5 text-sage-500 flex-shrink-0" />
                                                        <span className="flex-1 text-sm font-medium text-ink-700 truncate">Documento caricato</span>
                                                        <button
                                                            type="button"
                                                            onClick={handleBoardingPassRemove}
                                                            className="text-xs font-bold text-red-500 hover:text-red-700"
                                                        >
                                                            Rimuovi
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex items-center justify-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer transition-colors">
                                                        {uploadingBoardingPass
                                                            ? <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                                                            : <Upload className="w-5 h-5 text-neutral-400" />}
                                                        <span className="text-sm font-bold text-neutral-500">
                                                            {uploadingBoardingPass ? 'Caricamento...' : 'Carica foto o PDF'}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                                                            className="sr-only"
                                                            onChange={handleBoardingPassUpload}
                                                            disabled={uploadingBoardingPass}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                        {saving ? 'Salvataggio...' : isEditing ? 'Salva modifiche' : 'Aggiungi spostamento'}
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
