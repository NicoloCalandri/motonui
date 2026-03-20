'use client';

import { useState, useRef, useEffect } from 'react';
import type { LegType } from '@/lib/types';

// ─── Carrier lists by transport type ─────────────────────────────────────────

const AIRLINES = [
    'ITA Airways', 'Ryanair', 'EasyJet', 'Vueling', 'Wizz Air', 'Volotea',
    'Air Europa', 'Transavia', 'Norwegian', 'Lufthansa', 'Swiss', 'Austrian',
    'Air France', 'KLM', 'British Airways', 'Iberia', 'TAP Air Portugal',
    'SAS', 'Finnair', 'Turkish Airlines', 'Emirates', 'Etihad Airways',
    'Qatar Airways', 'Singapore Airlines', 'Cathay Pacific',
    'Japan Airlines (JAL)', 'ANA All Nippon Airways',
    'Delta Air Lines', 'United Airlines', 'American Airlines',
    'Air Canada', 'LATAM Airlines', 'Azul', 'GOL', 'Copa Airlines',
    'Avianca', 'Aeromexico', 'Air New Zealand', 'Qantas', 'Thai Airways',
    'Malaysia Airlines', 'IndiGo', 'Air India', 'flydubai', 'Pegasus',
    'SunExpress', 'Corendon', 'Blu-express', 'Air Malta', 'HiSky',
];

const TRAINS = [
    'Trenitalia', 'Italo', 'Frecciarossa', 'Frecciargento', 'Frecciabianca',
    'RegioExpress (Trenord)', 'TGV (SNCF)', 'Thalys', 'Eurostar',
    'Deutsche Bahn (DB)', 'ICE', 'ÖBB (Austrian Rail)', 'SBB (Swiss Rail)',
    'Renfe (Spagna)', 'NS (Olanda)', 'SNCB (Belgio)', 'PKP (Polonia)',
    'Intercity', 'Nightjet', 'EuroCity', 'FlixTrain',
];

const FERRIES = [
    'Grimaldi Lines', 'GNV (Grandi Navi Veloci)', 'Corsica Ferries',
    'Moby Lines', 'Tirrenia', 'Blu Navy', 'Caronte & Tourist',
    'Minoan Lines', 'Superfast Ferries', 'ANEK Lines',
    'Brittany Ferries', 'DFDS', 'Tallink Silja', 'Viking Line',
    'Stena Line', 'Irish Ferries', 'Baleàlia',
];

const BUSES = [
    'FlixBus', 'BlaBlaCar Bus', 'Megabus', 'National Express', 'Eurolines',
    'Marino Bus', 'SENA', 'Baltour', 'Flixbus Italia', 'Itabus',
    'Alsa', 'OUIBUS', 'Transdev', 'Busbud',
];

const CAR_RENTALS = [
    'Hertz', 'Avis', 'Europcar', 'Sixt', 'Budget', 'Alamo', 'National',
    'Enterprise', 'Thrifty', 'Dollar', 'Goldcar', 'Noleggiare',
    'Maggiore', 'Locauto', 'Centauro', 'Record Go', 'OK Mobility',
];

const OTHER_CARRIERS = [
    'Uber', 'Bolt', 'MyTaxi', 'Cabify', 'Free Now', 'BlaBlaLines',
];

const CARRIERS_BY_TYPE: Record<LegType, string[]> = {
    flight: AIRLINES,
    train: TRAINS,
    ferry: FERRIES,
    bus: BUSES,
    car: CAR_RENTALS,
    walk: [],
    other: OTHER_CARRIERS,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface CarrierSearchProps {
    legType: LegType;
    initialValue?: string;
    onChange: (value: string) => void;
}

export default function CarrierSearch({ legType, initialValue, onChange }: CarrierSearchProps) {
    const [query, setQuery] = useState(initialValue ?? '');
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setQuery(initialValue ?? '');
    }, [initialValue]);

    const candidates = CARRIERS_BY_TYPE[legType] ?? [];
    if (candidates.length === 0) {
        // walk: just a plain text input
        return (
            <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
                placeholder="es. Compagnia / operatore"
                className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-base"
            />
        );
    }

    const filtered = query.length < 1
        ? candidates.slice(0, 8)
        : candidates.filter((c) => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

    const handleSelect = (value: string) => {
        setQuery(value);
        onChange(value);
        setOpen(false);
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={legType === 'flight' ? 'es. Ryanair' : legType === 'train' ? 'es. Trenitalia' : legType === 'ferry' ? 'es. Grimaldi Lines' : legType === 'bus' ? 'es. FlixBus' : 'es. Hertz'}
                className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-base"
            />
            {open && filtered.length > 0 && (
                <ul className="absolute z-50 top-full mt-1 w-full bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                    {filtered.map((c) => (
                        <li key={c}>
                            <button
                                type="button"
                                onMouseDown={() => handleSelect(c)}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors text-sm font-semibold text-neutral-800"
                            >
                                {c}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
