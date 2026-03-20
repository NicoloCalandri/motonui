'use client';

import { useState } from 'react';
import type { TripWithDetails } from '@/lib/types';
import TripMap from '@/components/map/TripMap';
import TripStatsCard from '@/components/trip/TripStatsCard';
import { MapPin, Calendar, Globe, Route, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface OverviewTabProps {
    trip: TripWithDetails;
    onNavigate?: (tab: string) => void;
}

/**
 * Overview tab: Mapbox map of legs, quick stats, description.
 */
export default function OverviewTab({ trip, onNavigate }: OverviewTabProps) {
    const allLegs = trip.days?.flatMap((d) => d.legs ?? []) ?? [];
    const [currentBudget, setCurrentBudget] = useState<number | null>(trip.budget_eur ?? null);
    const [budgetInput, setBudgetInput] = useState<string>(
        trip.budget_eur != null ? String(trip.budget_eur) : ''
    );
    const [editingBudget, setEditingBudget] = useState(false);
    const [saving, setSaving] = useState(false);

    async function saveBudget() {
        setSaving(true);
        const value = budgetInput.trim() === '' ? null : Number(budgetInput);
        await fetch(`/api/trips/${trip.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ budget_eur: value }),
        });
        setCurrentBudget(value);
        setEditingBudget(false);
        setSaving(false);
    }

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {/* Description */}
            {trip.description && (
                <p className="text-ink-600 leading-relaxed">{trip.description}</p>
            )}

            {/* Date range info */}
            {trip.start_date && trip.end_date && (
                <div className="flex flex-wrap gap-4 text-sm text-ink-500">
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-terracotta-400" />
                        {format(new Date(trip.start_date), 'd MMM', { locale: it })} –{' '}
                        {format(new Date(trip.end_date), 'd MMM yyyy', { locale: it })}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-terracotta-400" />
                        {trip.destination}
                    </span>
                </div>
            )}

            {/* Map */}
            {allLegs.length > 0 ? (
                <div className="rounded-2xl overflow-hidden border border-sand-200 shadow-card">
                    <TripMap legs={allLegs} />
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 p-8 flex flex-col items-center gap-3 text-center">
                    <Route className="w-10 h-10 text-sand-300" />
                    <p className="font-display text-base font-semibold text-ink-700">Nessuno spostamento aggiunto</p>
                    <p className="text-sm text-ink-400">Aggiungi gli spostamenti nell'itinerario per vedere la mappa del viaggio.</p>
                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('itinerary')}
                            className="mt-1 px-4 py-2 bg-neutral-900 text-white text-sm font-bold rounded-2xl hover:bg-black transition-colors shadow-panel"
                        >
                            Vai all'itinerario
                        </button>
                    )}
                </div>
            )}

            {/* Stats */}
            <TripStatsCard tripId={trip.id} />

            {/* Budget */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-terracotta-400" />
                        Budget viaggio
                    </h3>
                    {!editingBudget && (
                        <button
                            onClick={() => setEditingBudget(true)}
                            className="text-xs font-bold text-ink-400 hover:text-ink-900 transition-colors"
                        >
                            {currentBudget != null ? 'Modifica' : 'Imposta'}
                        </button>
                    )}
                </div>
                {editingBudget ? (
                    <div className="flex items-center gap-2">
                        <span className="text-ink-400 font-semibold text-sm">€</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 border border-sand-300 rounded-xl px-3 py-2 text-sm font-display focus:outline-none focus:border-ink-900"
                        />
                        <button
                            onClick={saveBudget}
                            disabled={saving}
                            className="px-4 py-2 bg-[var(--color-ink)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {saving ? '…' : 'Salva'}
                        </button>
                        <button
                            onClick={() => {
                                setEditingBudget(false);
                                setBudgetInput(currentBudget != null ? String(currentBudget) : '');
                            }}
                            className="px-3 py-2 text-sm font-semibold text-ink-400 hover:text-ink-900 transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                ) : currentBudget != null ? (
                    <p className="font-display text-3xl font-bold text-ink-900">
                        €{currentBudget.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </p>
                ) : (
                    <p className="text-sm text-ink-400">Nessun budget impostato.</p>
                )}
            </div>

            {/* Members */}
            {trip.members && trip.members.length > 0 && (
                <div>
                    <h3 className="font-display text-lg font-semibold text-ink-900 mb-3">
                        <Globe className="inline w-4 h-4 mr-1 text-terracotta-400" />
                        Viaggiatori
                    </h3>
                    <div className="flex gap-3">
                        {trip.members.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-sand-100 rounded-xl text-sm">
                                <div className="w-7 h-7 bg-terracotta-100 rounded-full flex items-center justify-center text-terracotta-500 font-semibold text-xs">
                                    {m.user_id.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-ink-700">{m.role === 'owner' ? 'Proprietario' : 'Membro'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
