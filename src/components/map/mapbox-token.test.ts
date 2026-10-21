import { describe, it, expect } from 'vitest';
import { isMapboxAuthError, mapboxToken } from './mapbox-token';

describe('mapboxToken', () => {
    it('returns a real token', () => {
        expect(mapboxToken(' pk.eyJ1Ijoi.abc ')).toBe('pk.eyJ1Ijoi.abc');
    });

    it('treats a missing token and the .env.example placeholder as no token', () => {
        expect(mapboxToken(undefined)).toBeNull();
        expect(mapboxToken('')).toBeNull();
        expect(mapboxToken('pk.your-mapbox-token')).toBeNull();
    });
});

describe('isMapboxAuthError', () => {
    it('recognizes a refused token', () => {
        expect(isMapboxAuthError({ status: 401 })).toBe(true);
        expect(isMapboxAuthError({ status: 403 })).toBe(true);
    });

    it('ignores other failures', () => {
        expect(isMapboxAuthError({ status: 404 })).toBe(false);
        expect(isMapboxAuthError(new Error('tile'))).toBe(false);
        expect(isMapboxAuthError(null)).toBe(false);
    });
});
