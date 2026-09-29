'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Backpack, Briefcase, Plane, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { jsonFetcher } from '@/lib/fetcher';
import type { TripWithDetails, Leg, BaggageItem, PackingChecklist, ApiError } from '@/lib/types';
import BaggageFormPanel from './BaggageFormPanel';
import { PackingChecklistCard, PackingContextCard } from './packing-cards';
import { CATEGORY_LABELS, baggagePayload, emptyForm, formFromItem, type BaggageFormState } from './packing-form';

type PackingResponse = { checklist: PackingChecklist | null; stale: boolean };

interface PackingTabProps {
    trip: TripWithDetails;
}

export default function PackingTab({ trip }: PackingTabProps) {
    const baggageKey = `/api/trips/${trip.id}/baggage`;
    const packingKey = `/api/trips/${trip.id}/packing`;
    const { data: baggage = [], isLoading: loadingBaggage, mutate: mutateBaggage } = useSWR<BaggageItem[]>(baggageKey, jsonFetcher);
    const { data: packing, isLoading: loadingChecklist, mutate: mutatePacking } = useSWR<PackingResponse>(packingKey, jsonFetcher);
    const checklist = packing?.checklist ?? null;
    const stale = packing?.stale ?? false;
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<BaggageFormState>(emptyForm());
    const [saving, setSaving] = useState(false);

    const [generating, setGenerating] = useState(false);
    const [checklistError, setChecklistError] = useState<string | null>(null);

    const flights = useMemo<Leg[]>(
        () => (trip.days ?? []).flatMap((d) => d.legs ?? []).filter((l) => l.type === 'flight'),
        [trip.days]
    );

    const fetchBaggage = () => { void mutateBaggage(); };
    const fetchChecklist = () => { void mutatePacking(); };

    const openNewForm = () => {
        setForm(emptyForm());
        setFormOpen(true);
    };

    const openEditForm = (item: BaggageItem) => {
        setForm(formFromItem(item));
        setFormOpen(true);
    };

    const saveBaggage = async () => {
        setSaving(true);
        const payload = baggagePayload(form);

        const url = form.id ? `/api/trips/${trip.id}/baggage/${form.id}` : `/api/trips/${trip.id}/baggage`;
        const method = form.id ? 'PUT' : 'POST';

        try {
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            setFormOpen(false);
            fetchBaggage();
            fetchChecklist();
        } finally {
            setSaving(false);
        }
    };

    const deleteBaggage = async (id: string) => {
        if (!confirm('Eliminare questo bagaglio?')) return;
        await fetch(`/api/trips/${trip.id}/baggage/${id}`, { method: 'DELETE' });
        fetchBaggage();
        fetchChecklist();
    };

    const generateChecklist = async () => {
        setGenerating(true);
        setChecklistError(null);
        try {
            const response = await fetch(`/api/trips/${trip.id}/packing`, { method: 'POST' });
            if (!response.ok) {
                const err = (await response.json()) as ApiError;
                setChecklistError(err.error || 'Errore nella generazione della checklist.');
                return;
            }
            fetchChecklist();
        } finally {
            setGenerating(false);
        }
    };

    const toggleItem = async (itemId: string, checked: boolean) => {
        if (!checklist) return;
        const next = checked
            ? [...checklist.checked_item_ids, itemId]
            : checklist.checked_item_ids.filter((id) => id !== itemId);
        // Optimistic tick; the PATCH result is not refetched.
        void mutatePacking({ checklist: { ...checklist, checked_item_ids: next }, stale }, { revalidate: false });

        await fetch(`/api/trips/${trip.id}/packing`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, checked }),
        });
    };

    const stops = trip.days ?? [];
    const activities = trip.activities ?? [];

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-xl font-semibold text-ink-900">Bagagli</h2>
            </div>

            {/* ─── Bagagli ─────────────────────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-sand-100">
                    <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Backpack className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-semibold text-ink-900">I tuoi bagagli</h3>
                        <p className="text-xs text-ink-400">
                            {baggage.length === 0 ? 'Nessun bagaglio registrato' : `${baggage.length} bagagli registrati`}
                        </p>
                    </div>
                    <button
                        onClick={openNewForm}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Aggiungi
                    </button>
                </div>

                {loadingBaggage ? (
                    <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 text-ink-300 animate-spin" /></div>
                ) : (
                    <div className="divide-y divide-sand-100">
                        {baggage.map((item) => {
                            const leg = flights.find((f) => f.id === item.leg_id);
                            return (
                                <div key={item.id} className="p-4 flex items-center gap-3 group">
                                    <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Briefcase className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-ink-800 truncate">
                                            {item.label || CATEGORY_LABELS[item.category]}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                            {item.length_cm && item.width_cm && item.height_cm && (
                                                <span className="text-xs text-ink-400">
                                                    {item.length_cm}×{item.width_cm}×{item.height_cm}cm
                                                </span>
                                            )}
                                            {item.weight_kg && <span className="text-xs text-ink-400">max {item.weight_kg}kg</span>}
                                            {leg && (
                                                <span className="text-xs text-ink-500 flex items-center gap-1">
                                                    <Plane className="w-3 h-3" /> {leg.carrier ?? `${leg.from_name} → ${leg.to_name}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => openEditForm(item)} aria-label="Modifica" className="p-1.5 rounded-lg text-ink-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => deleteBaggage(item.id)} aria-label="Elimina" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {baggage.length === 0 && (
                            <div className="p-4 text-center text-ink-300 text-sm">
                                Aggiungi un bagaglio per generare una checklist su misura.
                            </div>
                        )}
                    </div>
                )}

                {formOpen && (
                    <BaggageFormPanel
                        form={form}
                        setForm={setForm}
                        flights={flights}
                        saving={saving}
                        onCancel={() => setFormOpen(false)}
                        onSave={saveBaggage}
                    />
                )}
            </div>

            <PackingContextCard checklist={checklist} stops={stops} activities={activities} />

            <PackingChecklistCard
                checklist={checklist}
                stale={stale}
                loading={loadingChecklist}
                generating={generating}
                error={checklistError}
                hasBaggage={baggage.length > 0}
                onGenerate={generateChecklist}
                onToggle={toggleItem}
            />
        </div>
    );
}
