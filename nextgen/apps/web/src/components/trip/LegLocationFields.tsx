import type { FieldError } from 'react-hook-form';
import LocationSearch, { type LocationResult } from '../map/LocationSearch';

interface LegLocationFieldsProps {
    fromInitial: string;
    toInitial: string;
    fromError?: FieldError;
    toError?: FieldError;
    onFromSelect: (r: LocationResult) => void;
    onFromTextChange: (text: string) => void;
    onToSelect: (r: LocationResult) => void;
    onToTextChange: (text: string) => void;
}

/**
 * "Da"/"A" `LocationSearch` pair used by `LegDrawer` for non-flight leg
 * types (train/car/ferry/bus/walk/other — flight uses `LegFlightSegments`
 * instead). Extracted out of LegDrawer.tsx's "Standard location search for
 * non-flight types" JSX block (src/components/trip/LegDrawer.tsx, ~40
 * lines) into its own file to keep LegDrawer.tsx under docs/CLAUDE.md's
 * 300-line-per-file rule — the old 648-line LegDrawer.tsx was not split at
 * all, and the prior port's 4-file split (LegDrawer/LegFlightSegments/
 * BoardingPassField/CurrencyCostField) still left LegDrawer.tsx at 493
 * lines. Logic/markup is a verbatim port of that block; the `setValue`/
 * `setFromCoords`/`setToCoords` calls (which need the parent form's
 * react-hook-form instance) became the four `onFrom*`/`onTo*` callback
 * props, matching `LegFlightSegments.tsx`'s existing callback-prop pattern.
 */
export default function LegLocationFields({
    fromInitial,
    toInitial,
    fromError,
    toError,
    onFromSelect,
    onFromTextChange,
    onToSelect,
    onToTextChange,
}: LegLocationFieldsProps) {
    return (
        <div className="grid grid-cols-1 gap-4">
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Da *</label>
                <LocationSearch
                    placeholder="es. Torino"
                    initialValue={fromInitial}
                    onSelect={onFromSelect}
                    onTextChange={onFromTextChange}
                />
                {fromError && (
                    <p className="mt-1 text-xs text-red-500">{fromError.message}</p>
                )}
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">A *</label>
                <LocationSearch
                    placeholder="es. San Paolo del Brasile"
                    initialValue={toInitial}
                    onSelect={onToSelect}
                    onTextChange={onToTextChange}
                />
                {toError && (
                    <p className="mt-1 text-xs text-red-500">{toError.message}</p>
                )}
            </div>
        </div>
    );
}
