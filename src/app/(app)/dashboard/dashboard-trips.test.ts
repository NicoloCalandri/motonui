import { describe, it, expect } from 'vitest';
import { greetingName, pickHeroTrip, recentTrips, tripCountLabel, type DashboardTrip } from './dashboard-trips';

const now = new Date('2026-10-20T10:00:00');

const trip = (overrides: Partial<DashboardTrip>): DashboardTrip => ({
    id: 'trip',
    title: 'Viaggio',
    destination: 'Ovunque',
    cover_image: null,
    start_date: null,
    end_date: null,
    status: 'planning',
    budget_eur: null,
    ...overrides,
});

describe('greetingName', () => {
    it('keeps only the first name', () => {
        expect(greetingName('Nicolò Calandri', 'n@example.com')).toBe('Nicolò');
        expect(greetingName('  Giorgia  ', null)).toBe('Giorgia');
    });

    it('falls back to the email local part, then to a generic name', () => {
        expect(greetingName(null, 'giorgia@example.com')).toBe('giorgia');
        expect(greetingName('   ', 'giorgia@example.com')).toBe('giorgia');
        expect(greetingName(null, null)).toBe('Viaggiatore');
    });
});

describe('tripCountLabel', () => {
    it('agrees in number', () => {
        expect(tripCountLabel(0)).toBe('0 viaggi');
        expect(tripCountLabel(1)).toBe('1 viaggio');
        expect(tripCountLabel(4)).toBe('4 viaggi');
    });
});

describe('pickHeroTrip', () => {
    it('prefers the active trip', () => {
        const hero = pickHeroTrip(
            [trip({ id: 'p', start_date: '2026-11-01' }), trip({ id: 'a', status: 'active' })],
            now,
        );
        expect(hero).toEqual({ trip: expect.objectContaining({ id: 'a' }), kind: 'active', daysToStart: null });
    });

    it('otherwise picks the planned trip that leaves soonest', () => {
        const hero = pickHeroTrip(
            [
                trip({ id: 'undated' }),
                trip({ id: 'later', start_date: '2026-12-24' }),
                trip({ id: 'soon', start_date: '2026-10-30' }),
                trip({ id: 'done', status: 'completed', start_date: '2026-10-21' }),
            ],
            now,
        );
        expect(hero?.trip.id).toBe('soon');
        expect(hero?.kind).toBe('upcoming');
        expect(hero?.daysToStart).toBe(10);
    });

    it('counts today as zero days', () => {
        expect(pickHeroTrip([trip({ start_date: '2026-10-20' })], now)?.daysToStart).toBe(0);
    });

    it('falls back to an undated plan without a countdown', () => {
        const hero = pickHeroTrip([trip({ id: 'past', start_date: '2026-01-01' }), trip({ id: 'undated' })], now);
        expect(hero?.daysToStart).toBeNull();
    });

    it('returns null without active or planned trips', () => {
        expect(pickHeroTrip([trip({ status: 'completed' }), trip({ status: 'archived' })], now)).toBeNull();
        expect(pickHeroTrip([], now)).toBeNull();
    });
});

describe('recentTrips', () => {
    it('excludes the hero and archived trips', () => {
        const list = recentTrips(
            [trip({ id: 'hero' }), trip({ id: 'old', status: 'archived' }), trip({ id: 'other' })],
            'hero',
        );
        expect(list.map((t) => t.id)).toEqual(['other']);
    });

    it('lists planned trips by departure, then completed ones from the most recent', () => {
        const list = recentTrips(
            [
                trip({ id: 'c-2024', status: 'completed', end_date: '2024-08-10' }),
                trip({ id: 'p-undated' }),
                trip({ id: 'c-2025', status: 'completed', end_date: '2025-08-10' }),
                trip({ id: 'p-dec', start_date: '2026-12-01' }),
                trip({ id: 'p-nov', start_date: '2026-11-01' }),
            ],
            null,
            10,
        );
        expect(list.map((t) => t.id)).toEqual(['p-nov', 'p-dec', 'p-undated', 'c-2025', 'c-2024']);
    });

    it('keeps at most three trips by default', () => {
        const many = ['a', 'b', 'c', 'd'].map((id) => trip({ id }));
        expect(recentTrips(many, null)).toHaveLength(3);
    });
});
