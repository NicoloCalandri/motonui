import { describe, expect, it } from 'vitest';
import { searchAirports } from './airports';

describe('searchAirports', () => {
    it('needs at least two characters', () => {
        expect(searchAirports('')).toEqual([]);
        expect(searchAirports(' f ')).toEqual([]);
    });

    it('matches the IATA prefix and builds the label', () => {
        const [fco] = searchAirports('fco');
        expect(fco).toMatchObject({ iata: 'FCO', city: 'Roma', countryCode: 'IT', label: 'FCO — Roma' });
        expect(fco.lat).toBeCloseTo(41.8, 1);
    });

    it('matches city and airport name case-insensitively, at most 8 results', () => {
        expect(searchAirports('glasgow').map((a) => a.iata)).toContain('GLA');
        expect(searchAirports('intl').length).toBeLessThanOrEqual(8);
    });
});
