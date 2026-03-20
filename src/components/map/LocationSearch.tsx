'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface LocationResult {
    name: string;
    lat: number;
    lng: number;
}

interface LocationSearchProps {
    placeholder?: string;
    /** Pre-fill the input — resets when changed (e.g. when drawer re-opens) */
    initialValue?: string;
    onSelect: (result: LocationResult) => void;
    /** Called on every keystroke so the parent can sync the plain text value */
    onTextChange?: (text: string) => void;
}

export default function LocationSearch({
    placeholder,
    initialValue,
    onSelect,
    onTextChange,
}: LocationSearchProps) {
    const [query, setQuery] = useState(initialValue ?? '');
    const [results, setResults] = useState<LocationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset internal value when parent signals a new initial value (drawer re-open)
    useEffect(() => {
        setQuery(initialValue ?? '');
        setResults([]);
        setOpen(false);
    }, [initialValue]);

    const handleChange = (value: string) => {
        setQuery(value);
        onTextChange?.(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
                if (!token) return;

                const res = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json` +
                        `?access_token=${token}&language=it&limit=5`
                );
                if (!res.ok) return;

                const data = (await res.json()) as {
                    features?: Array<{
                        place_name: string;
                        geometry: { coordinates: [number, number] };
                    }>;
                };

                const items = (data.features ?? []).map((f) => ({
                    name: f.place_name,
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                }));
                setResults(items);
                setOpen(items.length > 0);
            } catch {
                // ignore network errors silently
            } finally {
                setLoading(false);
            }
        }, 350);
    };

    const handleSelect = (r: LocationResult) => {
        setQuery(r.name);
        setResults([]);
        setOpen(false);
        onTextChange?.(r.name);
        onSelect(r);
    };

    return (
        <div className="relative">
            <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                {loading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />
                )}
                <input
                    value={query}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder}
                    className="w-full pl-11 pr-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                />
            </div>

            {open && results.length > 0 && (
                <ul className="absolute z-50 top-full mt-1 w-full bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                    {results.map((r, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                onMouseDown={() => handleSelect(r)}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors"
                            >
                                <span className="font-bold text-neutral-900 block truncate">
                                    {r.name.split(',')[0]}
                                </span>
                                {r.name.includes(',') && (
                                    <span className="text-neutral-400 text-xs block truncate">
                                        {r.name.slice(r.name.indexOf(',') + 2)}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
