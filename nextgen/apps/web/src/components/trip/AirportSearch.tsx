import { useState, useRef, useEffect } from 'react';
import { AIRPORTS } from './airports-data';

export interface AirportResult {
    iata: string;
    city: string;
    name: string;
    countryCode: string;
    /** Human-friendly label shown in the input after selection */
    label: string;
    lat: number;
    lng: number;
}

interface AirportSearchProps {
    placeholder?: string;
    initialValue?: string;
    onSelect: (result: AirportResult) => void;
    onTextChange?: (text: string) => void;
}

function searchAirports(query: string): AirportResult[] {
    const q = query.trim().toUpperCase();
    if (!q || q.length < 2) return [];

    const qLower = q.toLowerCase();

    return AIRPORTS
        .filter(([iata, city, name]) =>
            iata.startsWith(q) ||
            city.toLowerCase().includes(qLower) ||
            name.toLowerCase().includes(qLower)
        )
        .slice(0, 8)
        .map(([iata, city, name, countryCode, lat, lng]) => ({
            iata,
            city,
            name,
            countryCode,
            label: `${iata} — ${city}`,
            lat,
            lng,
        }));
}

/**
 * Airport (IATA code / city / name) autocomplete for flight legs, backed by
 * a static dataset (no network calls). Ported from
 * src/components/trip/AirportSearch.tsx.
 *
 * Touchpoint changes from the old component: no `'use client'` directive.
 * The static `AIRPORTS` dataset was moved to `airports-data.ts` (data only,
 * no logic) to keep this file under docs/CLAUDE.md's 300-line-per-file rule
 * — the old source didn't split it, but at ~370 lines combined it needed to.
 */
export default function AirportSearch({ placeholder, initialValue, onSelect, onTextChange }: AirportSearchProps) {
    const [query, setQuery] = useState(initialValue ?? '');
    const [results, setResults] = useState<AirportResult[]>([]);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(initialValue ?? '');
    }, [initialValue]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        onTextChange?.(val);
        const found = searchAirports(val);
        setResults(found);
        setOpen(found.length > 0);
    };

    const handleSelect = (result: AirportResult) => {
        setQuery(result.label);
        setOpen(false);
        onSelect(result);
    };

    return (
        <div className="relative" ref={containerRef}>
            <input
                type="text"
                value={query}
                onChange={handleChange}
                onFocus={() => query.length >= 2 && setOpen(results.length > 0)}
                placeholder={placeholder ?? 'Codice IATA o città (es. TRN, Roma)'}
                className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-sm"
                autoComplete="off"
            />

            {open && results.length > 0 && (
                <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden">
                    {results.map((r) => (
                        <li key={r.iata}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(r)}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                            >
                                <span className="font-mono font-black text-sm text-neutral-900 w-10 flex-shrink-0 bg-neutral-100 rounded-lg px-1.5 py-0.5 text-center">
                                    {r.iata}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-neutral-900 truncate">{r.city}</p>
                                    <p className="text-xs text-neutral-400 truncate">{r.name}</p>
                                </div>
                                <span className="ml-auto text-xs text-neutral-300 flex-shrink-0">{r.countryCode}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
