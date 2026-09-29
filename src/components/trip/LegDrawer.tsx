'use client';

import { useState, useEffect, type BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2 } from 'lucide-react';
import { useDialogA11y } from '@/components/ui/use-dialog-a11y';
import { hasBoardingPass } from '@/lib/boarding-pass';
import type { Leg } from '@/lib/types';
import CarrierSearch from '@/components/trip/CarrierSearch';
import BoardingPassField from './BoardingPassField';
import FlightSegmentsPicker from './FlightSegmentsPicker';
import LegScheduleFields from './LegScheduleFields';
import { LegBookingFields, LegLocationFields, LegTypePicker } from './leg-fields';
import { Schema, coordsOf, defaultSegment, formValuesFromLeg, legTimes, segmentsPayload, type Coords, type FlightSegment, type FormValues } from './leg-form';

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
    const panelRef = useDialogA11y<HTMLDivElement>(open, onClose);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

    // Multi-segment state (flight only)
    const [segments, setSegments] = useState<FlightSegment[]>([defaultSegment()]);

    // Boarding pass upload state
    const [hasBoardingPassFile, setHasBoardingPassFile] = useState(false);

    // Coordinates selected via geocoding (optional — map won't show if missing)
    const [fromCoords, setFromCoords] = useState<Coords | null>(null);
    const [toCoords, setToCoords] = useState<Coords | null>(null);
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
                reset(formValuesFromLeg(initialData, dayDate));
                setHasBoardingPassFile(hasBoardingPass(initialData));
                setFromInitial(initialData.from_name);
                setToInitial(initialData.to_name);
                setFromCoords(coordsOf(initialData.from_lat, initialData.from_lng));
                setToCoords(coordsOf(initialData.to_lat, initialData.to_lng));
                // Editing: single segment pre-filled
                setSegments([{ from_name: initialData.from_name, to_name: initialData.to_name }]);
            } else {
                reset({ type: 'flight', currency: 'EUR', departure_date: dayDate ?? undefined, arrival_date: dayDate ?? undefined });
                setFromInitial('');
                setToInitial('');
                setFromCoords(null);
                setToCoords(null);
                setHasBoardingPassFile(false);
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
            const { departure_at, arrival_at, checkin_opens_at } = legTimes(values, dayDate, initialData);

            // ── Multi-segment flight ──────────────────────────────────────────
            if (values.type === 'flight' && !isEditing && segments.length > 1) {
                const validSegments = segmentsPayload(segments);
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
                        segments: validSegments,
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
            setHasBoardingPassFile(false);
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
                    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="leg-drawer-title" tabIndex={-1} className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl animate-slide-up sm:animate-fade-in flex flex-col relative max-h-[90vh]">
                        <div className="p-6 sm:p-10 overflow-y-auto">
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />
                            <div className="flex items-center justify-between mb-8">
                                <h2 id="leg-drawer-title" className="text-3xl font-bold tracking-tight text-neutral-900">{isEditing ? 'Modifica spostamento' : 'Nuovo spostamento'}</h2>
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
                                <LegTypePicker value={selectedType} onChange={(type) => setValue('type', type)} />

                                {/* ── Origin / Destination ── */}
                                {selectedType === 'flight' ? (
                                    <FlightSegmentsPicker
                                        segments={segments}
                                        setSegments={setSegments}
                                        isEditing={isEditing}
                                        onOriginChange={(name, coords) => {
                                            setValue('from_name', name, { shouldValidate: true });
                                            if (coords) setFromCoords(coords);
                                        }}
                                        onDestinationChange={(name, coords) => {
                                            setValue('to_name', name, { shouldValidate: true });
                                            if (coords) setToCoords(coords);
                                        }}
                                    />
                                ) : (
                                    <LegLocationFields
                                        fromInitial={fromInitial}
                                        toInitial={toInitial}
                                        fromError={errors.from_name?.message}
                                        toError={errors.to_name?.message}
                                        onFromChange={(name, coords) => {
                                            setValue('from_name', name, { shouldValidate: true });
                                            if (coords !== undefined) setFromCoords(coords);
                                        }}
                                        onToChange={(name, coords) => {
                                            setValue('to_name', name, { shouldValidate: true });
                                            if (coords !== undefined) setToCoords(coords);
                                        }}
                                    />
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

                                <LegScheduleFields
                                    register={register}
                                    departureDate={watch('departure_date')}
                                    tripStartDate={tripStartDate}
                                    tripEndDate={tripEndDate}
                                />

                                <LegBookingFields register={register} type={selectedType} />

                                {selectedType === 'flight' && isEditing && initialData && (
                                    <BoardingPassField
                                        tripId={tripId}
                                        dayId={dayId}
                                        legId={initialData.id}
                                        hasFile={hasBoardingPassFile}
                                        onChange={setHasBoardingPassFile}
                                    />
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
