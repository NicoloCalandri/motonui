import type { UseFormRegister } from 'react-hook-form';
import LocationSearch, { type LocationResult } from '@/components/map/LocationSearch';
import { LEG_TYPES, type Coords, type FormValues } from './leg-form';

interface LegTypePickerProps {
    value: FormValues['type'];
    onChange: (type: FormValues['type']) => void;
}

/** Means of transport, as a grid of emoji buttons. */
export function LegTypePicker({ value, onChange }: LegTypePickerProps) {
    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Mezzo *</label>
            <div className="grid grid-cols-4 gap-2">
                {LEG_TYPES.map(({ id, label, emoji }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onChange(id as FormValues['type'])}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 ${value === id
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
    );
}

interface LegLocationFieldsProps {
    fromInitial: string;
    toInitial: string;
    fromError?: string;
    toError?: string;
    /** coords: picked place, null when the text was cleared, undefined while typing. */
    onFromChange: (name: string, coords?: Coords | null) => void;
    onToChange: (name: string, coords?: Coords | null) => void;
}

/** Origin and destination for non-flight legs (geocoded search). */
export function LegLocationFields({ fromInitial, toInitial, fromError, toError, onFromChange, onToChange }: LegLocationFieldsProps) {
    return (
        <div className="grid grid-cols-1 gap-4">
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Da *</label>
                <LocationSearch
                    placeholder="es. Torino"
                    initialValue={fromInitial}
                    onSelect={(r: LocationResult) => onFromChange(r.name, { lat: r.lat, lng: r.lng })}
                    onTextChange={(text) => onFromChange(text, text ? undefined : null)}
                />
                {fromError && (
                    <p className="mt-1 text-xs text-red-500">{fromError}</p>
                )}
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">A *</label>
                <LocationSearch
                    placeholder="es. San Paolo del Brasile"
                    initialValue={toInitial}
                    onSelect={(r: LocationResult) => onToChange(r.name, { lat: r.lat, lng: r.lng })}
                    onTextChange={(text) => onToChange(text, text ? undefined : null)}
                />
                {toError && (
                    <p className="mt-1 text-xs text-red-500">{toError}</p>
                )}
            </div>
        </div>
    );
}

interface LegBookingFieldsProps {
    register: UseFormRegister<FormValues>;
    type: FormValues['type'];
}

/** Booking reference, plus PNR and online check-in for flights. */
export function LegBookingFields({ register, type }: LegBookingFieldsProps) {
    return (
        <>
        {type !== 'walk' && (
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Numero prenotazione</label>
                <input
                    {...register('booking_ref')}
                    aria-label="Numero prenotazione"
                    placeholder="es. ABC123456"
                    className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                />
            </div>
        )}
            {type === 'flight' && (
                <>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">PNR (codice volo)</label>
                <input
                    {...register('pnr')}
                            aria-label="PNR (codice volo)"
                    placeholder="es. XKQM5A"
                    className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-mono font-bold tracking-widest uppercase"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Apertura check-in online</label>
                <input
                    {...register('checkin_opens_at')}
                            aria-label="Apertura check-in online"
                    type="datetime-local"
                    className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                />
            </div>
                </>
            )}
        </>
    );
}
