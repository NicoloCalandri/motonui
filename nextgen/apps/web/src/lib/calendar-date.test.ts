import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { calendarDate } from './calendar-date';

describe('calendarDate', () => {
    it('is that day at local midnight, whatever the zone of the machine', () => {
        const date = calendarDate('2026-11-01');

        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 1, 0]);
        expect(format(date, 'yyyy-MM-dd')).toBe('2026-11-01');
    });

    it.each(['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31'])('keeps the day of %s (year ends, daylight saving changes)', (value) => {
        expect(format(calendarDate(value), 'yyyy-MM-dd')).toBe(value);
    });

    it('reads only the day of a timestamp', () => {
        expect(format(calendarDate('2026-11-01T23:30:00+00:00'), 'yyyy-MM-dd')).toBe('2026-11-01');
    });
});
