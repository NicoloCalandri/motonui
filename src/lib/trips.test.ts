import { describe, it, expect } from 'vitest';
import { haversineDistanceKm } from './trips';

describe('haversineDistanceKm', () => {
    it('should return 0 for identical coordinates', () => {
        const dist = haversineDistanceKm(41.9, 12.5, 41.9, 12.5);
        expect(dist).toBe(0);
    });

    it('should calculate Rome to Milan correctly (~480 km)', () => {
        // Rome: 41.9028°N, 12.4964°E
        // Milan: 45.4654°N, 9.1866°E
        const dist = haversineDistanceKm(41.9028, 12.4964, 45.4654, 9.1866);
        expect(dist).toBeGreaterThan(470);
        expect(dist).toBeLessThan(510);
    });

    it('should calculate Lisbon to Tokyo correctly (~10,000 km)', () => {
        const dist = haversineDistanceKm(38.7169, -9.1399, 35.6762, 139.6503);
        expect(dist).toBeGreaterThan(10000);
        expect(dist).toBeLessThan(11500);
    });

    it('should be symmetric (A→B = B→A)', () => {
        const distAB = haversineDistanceKm(48.8566, 2.3522, 35.6762, 139.6503);
        const distBA = haversineDistanceKm(35.6762, 139.6503, 48.8566, 2.3522);
        expect(distAB).toBe(distBA);
    });
});
