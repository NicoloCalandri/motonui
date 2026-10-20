import { Plus, Trash2, ArrowRight } from 'lucide-react';
import AirportSearch, { type AirportResult } from './AirportSearch';

export interface FlightSegment {
    from_name: string;
    to_name: string;
    from_lat?: number | null;
    from_lng?: number | null;
    to_lat?: number | null;
    to_lng?: number | null;
}

interface LegFlightSegmentsProps {
    segments: FlightSegment[];
    setSegments: React.Dispatch<React.SetStateAction<FlightSegment[]>>;
    isEditing: boolean;
    /** Called when the FIRST segment's "from" airport is picked/typed — keeps the parent form's `from_name`/`fromCoords` in sync. */
    onFirstFromSelect: (r: AirportResult) => void;
    onFirstFromText: (text: string) => void;
    /** Called when the LAST segment's "to" airport is picked/typed — keeps the parent form's `to_name`/`toCoords` in sync. */
    onLastToSelect: (r: AirportResult) => void;
    onLastToText: (text: string) => void;
}

/**
 * Multi-stop flight segment picker (add/remove segments, per-segment
 * airport search, route summary). Extracted out of LegDrawer.tsx's
 * "Multi-segment airport picker" JSX block (src/components/trip/LegDrawer.tsx,
 * ~100 lines) into its own file to keep LegDrawer.tsx under
 * docs/CLAUDE.md's 300-line-per-file rule — the old 648-line LegDrawer.tsx
 * was not split at all. Logic is a verbatim port of that block; only the
 * `setValue`/`setFromCoords`/`setToCoords` calls (which need the parent
 * form's react-hook-form instance) were turned into the four `onFirst*`/
 * `onLast*` callback props.
 */
export default function LegFlightSegments({
    segments,
    setSegments,
    isEditing,
    onFirstFromSelect,
    onFirstFromText,
    onLastToSelect,
    onLastToText,
}: LegFlightSegmentsProps) {
    return (
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
                            if (idx === 0) onFirstFromSelect(r);
                        }}
                        onTextChange={(text) => {
                            setSegments(prev => prev.map((s, i) =>
                                i === idx ? { ...s, from_name: text } : s
                            ));
                            if (idx === 0) onFirstFromText(text);
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
                            if (idx === segments.length - 1) onLastToSelect(r);
                        }}
                        onTextChange={(text) => {
                            setSegments(prev => prev.map((s, i) =>
                                i === idx ? { ...s, to_name: text } : s
                            ));
                            if (idx === segments.length - 1) onLastToText(text);
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
    );
}
