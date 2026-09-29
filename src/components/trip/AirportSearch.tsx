'use client';

import { useState, useRef, useEffect } from 'react';
import { searchAirports, type AirportResult } from '@/lib/airports';

export type { AirportResult };

interface AirportSearchProps {
    placeholder?: string;
    initialValue?: string;
    onSelect: (result: AirportResult) => void;
    onTextChange?: (text: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
