/**
 * Formatting for times the user typed without a time zone (flight departures,
 * arrivals, check-in openings).
 *
 * The forms send them as naive strings ("2026-10-01T14:30:00") and the
 * TIMESTAMPTZ columns store them as that same wall-clock time in UTC. They
 * are therefore always read back in UTC: formatting in the viewer's or the
 * server's zone would shift what the user typed.
 */

const TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

function parse(value: string): Date {
    // A naive string would be parsed as local time: read it as UTC, as Postgres does.
    return new Date(HAS_OFFSET.test(value) ? value : `${value}Z`);
}

/** "14:30" */
export function wallClockTime(value: string): string {
    return TIME.format(parse(value));
}

/** "1 ott" */
export function wallClockDay(value: string): string {
    return DAY.format(parse(value));
}

/** "1 ott · 14:30" */
export function wallClockDayTime(value: string, separator = ' · '): string {
    return `${wallClockDay(value)}${separator}${wallClockTime(value)}`;
}
