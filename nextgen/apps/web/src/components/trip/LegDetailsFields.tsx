import type { UseFormRegisterReturn } from 'react-hook-form';
import type { LegType } from '@motonui/shared-types';
import CarrierSearch from './CarrierSearch';
import CurrencyCostField from './CurrencyCostField';
import BoardingPassField from './BoardingPassField';

interface LegDetailsFieldsProps {
    selectedType: LegType;
    isEditing: boolean;
    tripId: string;
    dayId?: string | null;
    legId?: string;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
    departureDateProps: UseFormRegisterReturn;
    departureTimeProps: UseFormRegisterReturn;
    arrivalDateProps: UseFormRegisterReturn;
    arrivalTimeProps: UseFormRegisterReturn;
    /** Current `departure_date` field value, used as the `min` for `arrival_date`. */
    departureDateValue?: string;
    currencyProps: UseFormRegisterReturn;
    costProps: UseFormRegisterReturn;
    bookingRefProps: UseFormRegisterReturn;
    pnrProps: UseFormRegisterReturn;
    checkinOpensAtProps: UseFormRegisterReturn;
    carrierValue: string;
    onCarrierChange: (value: string) => void;
    boardingPassUrl: string | null;
    onBoardingPassChange: (url: string | null) => void;
}

/**
 * Carrier + departure/arrival date-time + cost/currency + booking reference
 * + flight-only (PNR / check-in / boarding pass) fields for `LegDrawer`.
 * Extracted out of LegDrawer.tsx's "Carrier" through "Flight-only fields"
 * JSX blocks (src/components/trip/LegDrawer.tsx, ~95 lines combined) into
 * its own file to keep LegDrawer.tsx under docs/CLAUDE.md's 300-line-per-
 * file rule — the old 648-line LegDrawer.tsx was not split at all, and the
 * prior port's 4-file split (LegDrawer/LegFlightSegments/BoardingPassField/
 * CurrencyCostField) still left LegDrawer.tsx at 493 lines. Logic/markup is
 * a verbatim port of those blocks; each `register(...)` call became a
 * `UseFormRegisterReturn` prop, matching `CurrencyCostField.tsx`'s existing
 * pattern (rather than passing the whole react-hook-form `register`/`watch`
 * API down, which would require exporting `LegDrawer`'s private
 * `FormValues` type). The `watch('carrier')`/`setValue('carrier', ...)`
 * pair became `carrierValue`/`onCarrierChange` for the same reason.
 */
export default function LegDetailsFields({
    selectedType,
    isEditing,
    tripId,
    dayId,
    legId,
    tripStartDate,
    tripEndDate,
    departureDateProps,
    departureTimeProps,
    arrivalDateProps,
    arrivalTimeProps,
    departureDateValue,
    currencyProps,
    costProps,
    bookingRefProps,
    pnrProps,
    checkinOpensAtProps,
    carrierValue,
    onCarrierChange,
    boardingPassUrl,
    onBoardingPassChange,
}: LegDetailsFieldsProps) {
    return (
        <>
            {/* Carrier */}
            {selectedType !== 'walk' && (
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Compagnia / Vettore</label>
                    <CarrierSearch
                        legType={selectedType}
                        initialValue={carrierValue}
                        onChange={onCarrierChange}
                    />
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Partenza</label>
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            {...departureDateProps}
                            type="date"
                            min={tripStartDate || undefined}
                            max={tripEndDate || undefined}
                            className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                        />
                        <input
                            {...departureTimeProps}
                            type="time"
                            className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Arrivo</label>
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            {...arrivalDateProps}
                            type="date"
                            min={departureDateValue || tripStartDate || undefined}
                            max={tripEndDate || undefined}
                            className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                        />
                        <input
                            {...arrivalTimeProps}
                            type="time"
                            className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                        />
                    </div>
                </div>
            </div>

            <CurrencyCostField
                label="Costo stimato"
                currencyProps={currencyProps}
                costProps={costProps}
            />

            {/* Booking reference (all non-walk types) */}
            {selectedType !== 'walk' && (
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Numero prenotazione</label>
                    <input
                        {...bookingRefProps}
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
                            {...pnrProps}
                            placeholder="es. XKQM5A"
                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-mono font-bold tracking-widest uppercase"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Apertura check-in online</label>
                        <input
                            {...checkinOpensAtProps}
                            type="datetime-local"
                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                        />
                    </div>
                    {isEditing && dayId && legId && (
                        <BoardingPassField
                            tripId={tripId}
                            dayId={dayId}
                            legId={legId}
                            boardingPassUrl={boardingPassUrl}
                            onBoardingPassChange={onBoardingPassChange}
                        />
                    )}
                </>
            )}
        </>
    );
}
