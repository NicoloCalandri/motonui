/**
 * A calendar date ("2026-11-01": a trip day, a check-in, a deadline) as a
 * Date at local midnight, so that formatting it shows that same day in every
 * time zone. `new Date('2026-11-01')` is midnight UTC instead, which a
 * browser west of UTC shows as the day before.
 *
 * Only the date part of the value is read: a timestamp is cut to its day.
 */
export function calendarDate(value: string): Date {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
}
