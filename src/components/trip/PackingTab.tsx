'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
    Backpack, Briefcase, Plane, Plus, Pencil, Trash2, Sparkles, RefreshCw,
    CloudSun, MapPin, AlertTriangle, Loader2, CheckSquare, Square,
} from 'lucide-react';
import type {
    TripWithDetails, Leg, BaggageItem, BaggageCategory, PackingChecklist, ApiError,
} from '@/lib/types';

const CATEGORY_LABELS: Record<BaggageCategory, string> = {
    cabin_bag: 'Zaino / borsa piccola',
    cabin_trolley: 'Trolley cabina',
    checked: 'Bagaglio in stiva',
    other: 'Altro',
};

const CATEGORY_PRESETS: Record<BaggageCategory, { length_cm: number; width_cm: number; height_cm: number; weight_kg: number }> = {
    cabin_bag: { length_cm: 40, width_cm: 20, height_cm: 25, weight_kg: 8 },
    cabin_trolley: { length_cm: 55, width_cm: 40, height_cm: 20, weight_kg: 10 },
    checked: { length_cm: 75, width_cm: 50, height_cm: 30, weight_kg: 23 },
    other: { length_cm: 0, width_cm: 0, height_cm: 0, weight_kg: 0 },
};

interface BaggageFormState {
    id: string | null;
    leg_id: string | null;
    category: BaggageCategory;
    label: string;
    length_cm: string;
    width_cm: string;
    height_cm: string;
    weight_kg: string;
    notes: string;
}

function emptyForm(category: BaggageCategory = 'cabin_bag'): BaggageFormState {
    const preset = CATEGORY_PRESETS[category];
    return {
        id: null,
        leg_id: null,
        category,
        label: '',
        length_cm: preset.length_cm ? String(preset.length_cm) : '',
        width_cm: preset.width_cm ? String(preset.width_cm) : '',
        height_cm: preset.height_cm ? String(preset.height_cm) : '',
        weight_kg: preset.weight_kg ? String(preset.weight_kg) : '',
        notes: '',
    };
}

interface PackingTabProps {
    trip: TripWithDetails;
}

export default function PackingTab({ trip }: PackingTabProps) {
    const [baggage, setBaggage] = useState<BaggageItem[]>([]);
    const [loadingBaggage, setLoadingBaggage] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<BaggageFormState>(emptyForm());
    const [saving, setSaving] = useState(false);

    const [checklist, setChecklist] = useState<PackingChecklist | null>(null);
    const [stale, setStale] = useState(false);
    const [loadingChecklist, setLoadingChecklist] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [checklistError, setChecklistError] = useState<string | null>(null);

    const flights = useMemo<Leg[]>(
        () => (trip.days ?? []).flatMap((d) => d.legs ?? []).filter((l) => l.type === 'flight'),
        [trip.days]
    );

    const fetchBaggage = () => {
        setLoadingBaggage(true);
        fetch(`/api/trips/${trip.id}/baggage`)
            .then((r) => r.json())
            .then((data: BaggageItem[]) => setBaggage(data))
            .catch(() => {})
            .finally(() => setLoadingBaggage(false));
    };

    const fetchChecklist = () => {
        setLoadingChecklist(true);
        fetch(`/api/trips/${trip.id}/packing`)
            .then((r) => r.json())
            .then((data: { checklist: PackingChecklist | null; stale: boolean }) => {
                setChecklist(data.checklist);
                setStale(data.stale);
            })
            .catch(() => {})
            .finally(() => setLoadingChecklist(false));
    };

    useEffect(() => {
        fetchBaggage();
        fetchChecklist();
    }, [trip.id]);

    const openNewForm = () => {
        setForm(emptyForm());
        setFormOpen(true);
    };

    const openEditForm = (item: BaggageItem) => {
        setForm({
            id: item.id,
            leg_id: item.leg_id,
            category: item.category,
            label: item.label ?? '',
            length_cm: item.length_cm != null ? String(item.length_cm) : '',
            width_cm: item.width_cm != null ? String(item.width_cm) : '',
            height_cm: item.height_cm != null ? String(item.height_cm) : '',
            weight_kg: item.weight_kg != null ? String(item.weight_kg) : '',
            notes: item.notes ?? '',
        });
        setFormOpen(true);
    };

    const changeCategory = (category: BaggageCategory) => {
        const preset = CATEGORY_PRESETS[category];
        setForm((prev) => ({
            ...prev,
            category,
            length_cm: prev.length_cm || (preset.length_cm ? String(preset.length_cm) : ''),
            width_cm: prev.width_cm || (preset.width_cm ? String(preset.width_cm) : ''),
            height_cm: prev.height_cm || (preset.height_cm ? String(preset.height_cm) : ''),
            weight_kg: prev.weight_kg || (preset.weight_kg ? String(preset.weight_kg) : ''),
        }));
    };

    const saveBaggage = async () => {
        setSaving(true);
        const payload = {
            leg_id: form.leg_id || null,
            category: form.category,
            label: form.label || null,
            length_cm: form.length_cm ? Number(form.length_cm) : null,
            width_cm: form.width_cm ? Number(form.width_cm) : null,
            height_cm: form.height_cm ? Number(form.height_cm) : null,
            weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
            notes: form.notes || null,
        };

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
        setChecklist({ ...checklist, checked_item_ids: next });

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
                    <div className="p-4 border-t border-sand-100 bg-sand-50 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-ink-500">Categoria</label>
                                <select
                                    value={form.category}
                                    onChange={(e) => changeCategory(e.target.value as BaggageCategory)}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white"
                                >
                                    {(Object.keys(CATEGORY_LABELS) as BaggageCategory[]).map((c) => (
                                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                                    ))}
                                </select>
                            </div>
                            {flights.length > 0 && (
                                <div className="col-span-2">
                                    <label className="text-xs font-semibold text-ink-500">Volo collegato (opzionale)</label>
                                    <select
                                        value={form.leg_id ?? ''}
                                        onChange={(e) => setForm((p) => ({ ...p, leg_id: e.target.value || null }))}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white"
                                    >
                                        <option value="">Nessuno</option>
                                        {flights.map((f) => (
                                            <option key={f.id} value={f.id}>{f.carrier ? `${f.carrier} — ` : ''}{f.from_name} → {f.to_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-ink-500">Etichetta (opzionale)</label>
                                <input
                                    value={form.label}
                                    onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                                    placeholder={CATEGORY_LABELS[form.category]}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-ink-500">Lunghezza (cm)</label>
                                <input type="number" value={form.length_cm} onChange={(e) => setForm((p) => ({ ...p, length_cm: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-ink-500">Larghezza (cm)</label>
                                <input type="number" value={form.width_cm} onChange={(e) => setForm((p) => ({ ...p, width_cm: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-ink-500">Altezza (cm)</label>
                                <input type="number" value={form.height_cm} onChange={(e) => setForm((p) => ({ ...p, height_cm: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-ink-500">Peso max (kg)</label>
                                <input type="number" value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-ink-500">Note</label>
                                <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-sand-200 text-sm bg-white" />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setFormOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-500 hover:bg-sand-100">Annulla</button>
                            <button onClick={saveBaggage} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                                {saving ? 'Salvataggio…' : 'Salva'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Meteo & tappe ───────────────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-sand-100">
                    <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CloudSun className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-semibold text-ink-900">Meteo & tappe</h3>
                        <p className="text-xs text-ink-400">Usati per generare la checklist</p>
                    </div>
                </div>
                <div className="p-4 space-y-3">
                    {checklist?.weather_snapshot && checklist.weather_snapshot.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {checklist.weather_snapshot.map((d) => (
                                <div key={d.date} className="flex-shrink-0 px-3 py-2 bg-sky-50 rounded-xl text-center min-w-[84px]">
                                    <p className="text-[11px] font-semibold text-sky-700">{format(new Date(d.date), 'd MMM', { locale: it })}</p>
                                    <p className="text-sm font-bold text-sky-900">{Number.isFinite(d.temp_max_c) ? `${d.temp_min_c}–${d.temp_max_c}°` : '—'}</p>
                                    <p className="text-[11px] text-sky-600">{d.condition}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-ink-300">Genera la checklist per vedere il meteo previsto per il periodo del viaggio.</p>
                    )}

                    {stops.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-ink-500 mb-1.5">Tappe</p>
                            <div className="flex flex-wrap gap-1.5">
                                {stops.map((d) => (
                                    <span key={d.id} className="flex items-center gap-1 px-2 py-1 bg-sand-100 rounded-lg text-xs text-ink-600">
                                        <MapPin className="w-3 h-3 text-ink-400" />
                                        {d.title || format(new Date(d.date), 'd MMM', { locale: it })}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {activities.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-ink-500 mb-1.5">Attività</p>
                            <div className="flex flex-wrap gap-1.5">
                                {activities.map((a) => (
                                    <span key={a.id} className="px-2 py-1 bg-sand-100 rounded-lg text-xs text-ink-600">{a.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Checklist ───────────────────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-sand-100">
                    <div className="w-9 h-9 bg-terracotta-400 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-semibold text-ink-900">Checklist</h3>
                        <p className="text-xs text-ink-400">Generata con AI da meteo, tappe e bagagli</p>
                    </div>
                    <button
                        onClick={generateChecklist}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta-400 text-white rounded-xl text-xs font-bold hover:bg-terracotta-500 transition-colors disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {checklist ? 'Rigenera' : 'Genera'}
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {checklistError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {checklistError}
                        </div>
                    )}

                    {stale && checklist && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            I dati del viaggio sono cambiati da quando è stata generata la checklist. Rigenerala per aggiornarla.
                        </div>
                    )}

                    {loadingChecklist ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-ink-300 animate-spin" /></div>
                    ) : checklist && checklist.categories.length > 0 ? (
                        checklist.categories.map((cat) => (
                            <div key={cat.name}>
                                <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">{cat.name}</p>
                                <div className="space-y-1">
                                    {cat.items.map((item) => {
                                        const checked = checklist.checked_item_ids.includes(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleItem(item.id, !checked)}
                                                className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-sand-50 text-left transition-colors"
                                            >
                                                {checked ? (
                                                    <CheckSquare className="w-4 h-4 text-terracotta-400 flex-shrink-0 mt-0.5" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-ink-300 flex-shrink-0 mt-0.5" />
                                                )}
                                                <span className={`text-sm ${checked ? 'text-ink-300 line-through' : 'text-ink-700'}`}>
                                                    {item.label}{item.qty > 1 ? ` ×${item.qty}` : ''}
                                                    {item.note && <span className="block text-xs text-ink-400">{item.note}</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-ink-300 text-center py-2">
                            {baggage.length === 0
                                ? 'Aggiungi almeno un bagaglio, poi genera la checklist.'
                                : 'Nessuna checklist generata ancora.'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
