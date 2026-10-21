import { describe, it, expect } from 'vitest';
import { normalizeTripQuery, tripSearchFilter } from './trip-search';

describe('normalizeTripQuery', () => {
    it('keeps letters, digits and simple separators', () => {
        expect(normalizeTripQuery('  Brasile 2026 ')).toBe('Brasile 2026');
        expect(normalizeTripQuery("Côte d'Azur")).toBe("Côte d'Azur");
        expect(normalizeTripQuery('São-Paulo')).toBe('São-Paulo');
    });

    it('drops characters that would alter the PostgREST filter', () => {
        expect(normalizeTripQuery('a,b)or(id.eq.1')).toBe('a b or id.eq.1');
        expect(normalizeTripQuery('100%_*"x"')).toBe('100 x');
    });

    it('handles missing, repeated and oversized params', () => {
        expect(normalizeTripQuery(undefined)).toBe('');
        expect(normalizeTripQuery(['Lisbona', 'Porto'])).toBe('Lisbona');
        expect(normalizeTripQuery('x'.repeat(200))).toHaveLength(80);
    });
});

describe('tripSearchFilter', () => {
    it('matches title or destination', () => {
        expect(tripSearchFilter('Rio')).toBe('title.ilike.%Rio%,destination.ilike.%Rio%');
    });
});
