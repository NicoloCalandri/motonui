import { X, Loader2 } from 'lucide-react';
import { useDialogA11y } from '../ui/use-dialog-a11y';
import type { Leg } from '@motonui/shared-types';
import type { LocationResult } from '../map/LocationSearch';
import { useLegDrawerForm, type LegFormValues } from './useLegDrawerForm';
import LegFlightSegments from './LegFlightSegments';
import LegLocationFields from './LegLocationFields';
import LegDetailsFields from './LegDetailsFields';

const LEG_TYPES = [
    { id: 'flight', label: 'Volo', emoji: '✈️' },
    { id: 'train', label: 'Treno', emoji: '🚆' },
    { id: 'car', label: 'Auto', emoji: '🚗' },
    { id: 'ferry', label: 'Traghetto', emoji: '⛴️' },
    { id: 'bus', label: 'Bus', emoji: '🚌' },
    { id: 'walk', label: 'A piedi', emoji: '🚶' },
    { id: 'other', label: 'Altro', emoji: '📍' },
];

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
 * Split into seven files to stay under docs/CLAUDE.md's 300-line-per-file
 * rule (the old file was not split at all): this file (JSX layout only —
 * type selector, origin/destination branch, submit buttons, modal chrome),
 * `useLegDrawerForm.ts` (react-hook-form setup, reset-on-open effect,
 * segment/boarding-pass/coordinate state, and the `onSubmit` mutation
 * handler), `LegFlightSegments.tsx` (multi-stop airport picker),
 * `LegLocationFields.tsx` (the "Da"/"A" `LocationSearch` pair for
 * non-flight types), `LegDetailsFields.tsx` (carrier/date-time/cost/
 * booking-ref/flight-only fields), `BoardingPassField.tsx` (upload/remove
 * UI), and the shared `CurrencyCostField.tsx`. Two earlier passes left this
 * file at 493, then 408 lines — both still over the limit — before this
 * `useLegDrawerForm` hook extraction brought it under 300.
 *
 * Touchpoint changes from the old component:
 * - No `'use client'` directive.
 * - `Leg` type from `@motonui/shared-types` instead of `@/lib/types`.
 * - `LocationSearch`(via `LegLocationFields`)/`AirportSearch`(via
 *   `LegFlightSegments`)/`CarrierSearch`(via `LegDetailsFields`) imported
 *   from their new paths.
 * - Raw `fetch(...)` + manual `res.ok` check -> `apiFetch(..., token)` with
 *   the auth token from `useAuth()` (now inside `useLegDrawerForm`). The
 *   old component already wrapped its save in `try`/`catch`/`finally`, so
 *   this touchpoint — and the later move of that logic into its own hook —
 *   carries no stuck-loading-state risk; the `try`/`catch`/`finally` shape
 *   is unchanged, just relocated.
 * - Boarding-pass upload/remove: see `BoardingPassField.tsx`'s doc comment
 *   — it's rendered (via `LegDetailsFields`) only when `isEditing` AND
 *   `dayId` AND `legId` are all present, whereas the old component rendered
 *   it whenever `isEditing` regardless of `dayId`, with its upload/remove
 *   handlers silently no-op-ing if `dayId` was missing (which happens for a
 *   top-level leg — e.g. edited from the Bookings tab, which doesn't pass a
 *   `dayId` prop to `LegDrawer` at all). This is a disclosed, intentional
 *   deviation, not a straight port: hiding a control that would otherwise
 *   silently fail is a minor behavior change, made necessary by
 *   `BoardingPassField`'s `dayId` prop being required (a string, not
 *   `string | undefined`) for its URL construction.
 */
export default function LegDrawer({ tripId, dayId, open, onClose, onSaved, dayDate, initialData, tripStartDate, tripEndDate }: LegDrawerProps) {
    const {
        register, handleSubmit, watch, setValue, errors,
        saving, error, isEditing, selectedType,
        segments, setSegments,
        boardingPassUploaded, setBoardingPassUploaded,
        setFromCoords, setToCoords,
        fromInitial, toInitial,
        onSubmit,
    } = useLegDrawerForm({ tripId, dayId, open, onClose, onSaved, dayDate, initialData });

    const panelRef = useDialogA11y<HTMLDivElement>(open, onClose);

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
                                {/* Type selector */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Mezzo *</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {LEG_TYPES.map(({ id, label, emoji }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setValue('type', id as LegFormValues['type'])}
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
                                    <LegLocationFields
                                        fromInitial={fromInitial}
                                        toInitial={toInitial}
                                        fromError={errors.from_name}
                                        toError={errors.to_name}
                                        onFromSelect={(r: LocationResult) => {
                                            setValue('from_name', r.name, { shouldValidate: true });
                                            setFromCoords({ lat: r.lat, lng: r.lng });
                                        }}
                                        onFromTextChange={(text) => {
                                            setValue('from_name', text, { shouldValidate: true });
                                            if (!text) setFromCoords(null);
                                        }}
                                        onToSelect={(r: LocationResult) => {
                                            setValue('to_name', r.name, { shouldValidate: true });
                                            setToCoords({ lat: r.lat, lng: r.lng });
                                        }}
                                        onToTextChange={(text) => {
                                            setValue('to_name', text, { shouldValidate: true });
                                            if (!text) setToCoords(null);
                                        }}
                                    />
                                )}

                                <LegDetailsFields
                                    selectedType={selectedType}
                                    isEditing={isEditing}
                                    tripId={tripId}
                                    dayId={dayId}
                                    legId={initialData?.id}
                                    tripStartDate={tripStartDate}
                                    tripEndDate={tripEndDate}
                                    departureDateProps={register('departure_date')}
                                    departureTimeProps={register('departure_time')}
                                    arrivalDateProps={register('arrival_date')}
                                    arrivalTimeProps={register('arrival_time')}
                                    departureDateValue={watch('departure_date')}
                                    currencyProps={register('currency')}
                                    costProps={register('cost')}
                                    bookingRefProps={register('booking_ref')}
                                    pnrProps={register('pnr')}
                                    checkinOpensAtProps={register('checkin_opens_at')}
                                    carrierValue={watch('carrier') ?? ''}
                                    onCarrierChange={(val) => setValue('carrier', val || null)}
                                    boardingPassUploaded={boardingPassUploaded}
                                    onBoardingPassChange={setBoardingPassUploaded}
                                />

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
