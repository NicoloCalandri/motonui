import { describe, expect, it } from 'vitest';
import { dayItemPath, emptyToNull } from './form-payload';

describe('emptyToNull', () => {
    it('turns empty strings into null and leaves the rest alone', () => {
        expect(emptyToNull({ name: 'Te Moana', time: '', covers: 0, notes: null, split: false })).toEqual({
            name: 'Te Moana', time: null, covers: 0, notes: null, split: false,
        });
    });

    it('keeps a string of spaces: trimming is the schema\'s job', () => {
        expect(emptyToNull({ notes: ' ' })).toEqual({ notes: ' ' });
    });
});

describe('dayItemPath', () => {
    it('uses the day when there is one', () => {
        expect(dayItemPath('t', 'legs', 'd')).toBe('/api/trips/t/days/d/legs');
        expect(dayItemPath('t', 'legs', 'd', 'l')).toBe('/api/trips/t/days/d/legs/l');
    });

    it.each([null, undefined, ''])('uses the route without a day for %j', (dayId) => {
        expect(dayItemPath('t', 'accommodations', dayId)).toBe('/api/trips/t/accommodations');
        expect(dayItemPath('t', 'accommodations', dayId, 'a')).toBe('/api/trips/t/accommodations/a');
    });
});
