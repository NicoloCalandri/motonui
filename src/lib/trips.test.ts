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

    it('returns a positive value for any two different points', () => {
        // Two points 1 degree apart on the equator
        const dist = haversineDistanceKm(0, 0, 0, 1);
        expect(dist).toBeGreaterThan(0);
    });

    it('calculates equatorial distance correctly (~111 km per degree)', () => {
        const dist = haversineDistanceKm(0, 0, 0, 1);
        expect(dist).toBeGreaterThan(110);
        expect(dist).toBeLessThan(115);
    });

    it('calculates distance between cities in southern hemisphere', () => {
        // Sydney (-33.8688, 151.2093) to Melbourne (-37.8136, 144.9631) ≈ 714 km
        const dist = haversineDistanceKm(-33.8688, 151.2093, -37.8136, 144.9631);
        expect(dist).toBeGreaterThan(700);
        expect(dist).toBeLessThan(730);
    });

    it('calculates distance crossing the prime meridian (London to Paris)', () => {
        // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ≈ 340–342 km
        const dist = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
        expect(dist).toBeGreaterThan(335);
        expect(dist).toBeLessThan(360);
    });

    it('calculates distance crossing the antimeridian (negative to positive longitude)', () => {
        // Los Angeles (34.05, -118.24) to Tokyo (35.68, 139.69) ≈ 8700–9100 km
        const dist = haversineDistanceKm(34.05, -118.24, 35.68, 139.69);
        expect(dist).toBeGreaterThan(8700);
        expect(dist).toBeLessThan(9200);
    });

    it('result is rounded to 1 decimal place', () => {
        const dist = haversineDistanceKm(41.9028, 12.4964, 45.4654, 9.1866);
        const decimalPart = String(dist).split('.')[1];
        expect(decimalPart === undefined || decimalPart.length <= 1).toBe(true);
    });
});
