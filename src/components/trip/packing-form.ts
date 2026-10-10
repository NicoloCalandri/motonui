import type { BaggageCategory, BaggageItem } from '@/lib/types';

export const CATEGORY_LABELS: Record<BaggageCategory, string> = {
    cabin_bag: 'Zaino / borsa piccola',
    cabin_trolley: 'Trolley cabina',
    checked: 'Bagaglio in stiva',
    other: 'Altro',
};

export const CATEGORY_PRESETS: Record<BaggageCategory, { length_cm: number; width_cm: number; height_cm: number; weight_kg: number }> = {
    cabin_bag: { length_cm: 40, width_cm: 20, height_cm: 25, weight_kg: 8 },
    cabin_trolley: { length_cm: 55, width_cm: 40, height_cm: 20, weight_kg: 10 },
    checked: { length_cm: 75, width_cm: 50, height_cm: 30, weight_kg: 23 },
    other: { length_cm: 0, width_cm: 0, height_cm: 0, weight_kg: 0 },
};

export interface BaggageFormState {
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

export function emptyForm(category: BaggageCategory = 'cabin_bag'): BaggageFormState {
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

/** Form state for an existing item (numbers as strings for the inputs). */
export function formFromItem(item: BaggageItem): BaggageFormState {
    return {
        id: item.id,
        leg_id: item.leg_id,
        category: item.category,
        label: item.label ?? '',
        length_cm: item.length_cm != null ? String(item.length_cm) : '',
        width_cm: item.width_cm != null ? String(item.width_cm) : '',
        height_cm: item.height_cm != null ? String(item.height_cm) : '',
        weight_kg: item.weight_kg != null ? String(item.weight_kg) : '',
        notes: item.notes ?? '',
    };
}

/** Switching category fills only the empty measures with the category preset. */
export function withCategory(prev: BaggageFormState, category: BaggageCategory): BaggageFormState {
    const preset = CATEGORY_PRESETS[category];
    return {
        ...prev,
        category,
        length_cm: prev.length_cm || (preset.length_cm ? String(preset.length_cm) : ''),
        width_cm: prev.width_cm || (preset.width_cm ? String(preset.width_cm) : ''),
        height_cm: prev.height_cm || (preset.height_cm ? String(preset.height_cm) : ''),
        weight_kg: prev.weight_kg || (preset.weight_kg ? String(preset.weight_kg) : ''),
    };
}

/** Request body for POST/PUT …/baggage. */
export function baggagePayload(form: BaggageFormState) {
    return {
        leg_id: form.leg_id || null,
        category: form.category,
        label: form.label || null,
        length_cm: form.length_cm ? Number(form.length_cm) : null,
        width_cm: form.width_cm ? Number(form.width_cm) : null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        notes: form.notes || null,
    };
}
