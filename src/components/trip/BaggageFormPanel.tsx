import type { Dispatch, SetStateAction } from 'react';
import type { BaggageCategory, Leg } from '@/lib/types';
import { CATEGORY_LABELS, withCategory, type BaggageFormState } from './packing-form';

interface BaggageFormPanelProps {
    form: BaggageFormState;
    setForm: Dispatch<SetStateAction<BaggageFormState>>;
    flights: Leg[];
    saving: boolean;
    onCancel: () => void;
    onSave: () => void;
}

/** Inline add/edit form of the packing tab. */
export default function BaggageFormPanel({ form, setForm, flights, saving, onCancel, onSave }: BaggageFormPanelProps) {
    return (
        <div className="p-4 border-t border-sand-100 bg-sand-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="text-xs font-semibold text-ink-500">Categoria</label>
                    <select
                        value={form.category}
                        onChange={(e) => setForm((p) => withCategory(p, e.target.value as BaggageCategory))}
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
                <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-500 hover:bg-sand-100">Annulla</button>
                <button onClick={onSave} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                    {saving ? 'Salvataggio…' : 'Salva'}
                </button>
            </div>
        </div>
    );
}
