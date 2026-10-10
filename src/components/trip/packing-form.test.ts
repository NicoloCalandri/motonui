import { describe, expect, it } from 'vitest';
import type { BaggageItem } from '@/lib/types';
import { baggagePayload, emptyForm, formFromItem, withCategory } from './packing-form';

describe('packing form', () => {
    it('starts from the category preset', () => {
        expect(emptyForm('cabin_trolley')).toMatchObject({ category: 'cabin_trolley', length_cm: '55', weight_kg: '10', label: '' });
        expect(emptyForm('other').length_cm).toBe('');
    });

    it('keeps typed measures when the category changes', () => {
        const next = withCategory({ ...emptyForm('other'), weight_kg: '7' }, 'checked');
        expect(next).toMatchObject({ category: 'checked', weight_kg: '7', length_cm: '75' });
    });

    it('round-trips an item into a payload with numbers and nulls', () => {
        const item = {
            id: 'b-1', leg_id: null, category: 'cabin_bag', label: null, length_cm: 40, width_cm: 20, height_cm: 25,
            weight_kg: null, notes: null,
        } as unknown as BaggageItem;
        expect(baggagePayload(formFromItem(item))).toEqual({
            leg_id: null, category: 'cabin_bag', label: null, length_cm: 40, width_cm: 20, height_cm: 25, weight_kg: null, notes: null,
        });
    });
});
