import { afterEach, describe, expect, it } from 'vitest';
import { wallClockDay, wallClockDayTime, wallClockTime } from './wall-clock';

describe('wall-clock formatting', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
        process.env.TZ = originalTz;
    });

    // A flight typed as 23:30 on 1 October is stored as 23:30 UTC.
    const stored = '2026-10-01T23:30:00+00:00';

    it.each(['Europe/Rome', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC'])('shows the typed time in %s', (tz) => {
        process.env.TZ = tz;
        expect(wallClockTime(stored)).toBe('23:30');
        expect(wallClockDay(stored)).toBe('1 ott');
        expect(wallClockDayTime(stored)).toBe('1 ott · 23:30');
    });

    it('keeps a time that does not exist locally on a daylight-saving day', () => {
        process.env.TZ = 'Europe/Rome';
        // 02:30 on 29 March 2026 is skipped in Italy.
        expect(wallClockTime('2026-03-29T02:30:00+00:00')).toBe('02:30');
    });

    it('accepts the naive form the API receives', () => {
        process.env.TZ = 'Europe/Rome';
        expect(wallClockTime('2026-10-01T07:05:00')).toBe('07:05');
    });
});
