import { describe, expect, it } from 'vitest';
import {
    boardingPassExtension,
    boardingPassHref,
    boardingPassMimeType,
    buildBoardingPassPath,
    isBoardingPassPathForTrip,
    isPdfBoardingPass,
    legacyBoardingPassPath,
} from '@/lib/boarding-pass';

const TRIP = '11111111-1111-1111-1111-111111111111';
const OTHER_TRIP = '22222222-2222-2222-2222-222222222222';
const LEG = '33333333-3333-3333-3333-333333333333';
const DAY = '44444444-4444-4444-4444-444444444444';

describe('boardingPassExtension', () => {
    it('maps allowed MIME types', () => {
        expect(boardingPassExtension('application/pdf')).toBe('pdf');
        expect(boardingPassExtension('image/jpeg')).toBe('jpg');
        expect(boardingPassExtension('image/heic')).toBe('heic');
    });

    it('rejects anything else', () => {
        expect(boardingPassExtension('video/mp4')).toBeNull();
        expect(boardingPassExtension('text/html')).toBeNull();
    });
});

describe('boardingPassMimeType', () => {
    it('infers the type from the extension', () => {
        expect(boardingPassMimeType('trips/x/boarding-passes/a.pdf')).toBe('application/pdf');
        expect(boardingPassMimeType('trips/x/boarding-passes/a.JPEG')).toBe('image/jpeg');
    });

    it('falls back to a binary type', () => {
        expect(boardingPassMimeType('trips/x/boarding-passes/a.html')).toBe('application/octet-stream');
    });
});

describe('buildBoardingPassPath', () => {
    it('builds a non-guessable path under the trip prefix', () => {
        const path = buildBoardingPassPath(TRIP, LEG, 'pdf', 'rand');
        expect(path).toBe(`trips/${TRIP}/boarding-passes/${LEG}-rand.pdf`);
        expect(isBoardingPassPathForTrip(path, TRIP)).toBe(true);
    });

    it('uses a random id by default', () => {
        expect(buildBoardingPassPath(TRIP, LEG, 'pdf')).not.toBe(buildBoardingPassPath(TRIP, LEG, 'pdf'));
    });
});

describe('isBoardingPassPathForTrip', () => {
    it('accepts a file directly under the trip prefix', () => {
        expect(isBoardingPassPathForTrip(`trips/${TRIP}/boarding-passes/${LEG}-x.jpg`, TRIP)).toBe(true);
    });

    it.each([
        null,
        '',
        `trips/${OTHER_TRIP}/boarding-passes/${LEG}.jpg`,
        `trips/${TRIP}/boarding-passes/../../${OTHER_TRIP}/boarding-passes/a.jpg`,
        `trips/${TRIP}/boarding-passes/sub/a.jpg`,
        `trips/${TRIP}/boarding-passes/`,
        `trips/${TRIP}/boarding-passes/.hidden`,
        `trips/${TRIP}/original/a.jpg`,
        `avatars/${TRIP}/boarding-passes/a.jpg`,
    ])('rejects %j', (path) => {
        expect(isBoardingPassPathForTrip(path, TRIP)).toBe(false);
    });
});

describe('legacyBoardingPassPath', () => {
    const SUPABASE_URL = 'https://abc.supabase.co';

    it('extracts the path from a public trip-media URL', () => {
        const url = `${SUPABASE_URL}/storage/v1/object/public/trip-media/trips/${TRIP}/boarding-passes/${LEG}.pdf`;
        expect(legacyBoardingPassPath(url, SUPABASE_URL)).toBe(`trips/${TRIP}/boarding-passes/${LEG}.pdf`);
        expect(legacyBoardingPassPath(url, `${SUPABASE_URL}/`)).toBe(`trips/${TRIP}/boarding-passes/${LEG}.pdf`);
    });

    it('ignores other hosts and buckets', () => {
        expect(legacyBoardingPassPath('https://evil.example/storage/v1/object/public/trip-media/x', SUPABASE_URL)).toBeNull();
        expect(legacyBoardingPassPath(`${SUPABASE_URL}/storage/v1/object/public/avatars/x`, SUPABASE_URL)).toBeNull();
        expect(legacyBoardingPassPath(null, SUPABASE_URL)).toBeNull();
    });
});

describe('boardingPassHref / isPdfBoardingPass', () => {
    const base = { id: LEG, trip_id: TRIP, day_id: DAY, boarding_pass_url: null };

    it('points to the authenticated proxy route for private files', () => {
        const leg = { ...base, boarding_pass_path: `trips/${TRIP}/boarding-passes/${LEG}-r.pdf` };
        expect(boardingPassHref(leg)).toBe(`/api/trips/${TRIP}/days/${DAY}/legs/${LEG}/boarding-pass`);
        expect(boardingPassHref(leg, { download: true })).toBe(`/api/trips/${TRIP}/days/${DAY}/legs/${LEG}/boarding-pass?download=1`);
        expect(isPdfBoardingPass(leg)).toBe(true);
    });

    it('falls back to the legacy URL until migrated', () => {
        const leg = { ...base, boarding_pass_path: null, boarding_pass_url: 'https://x/a.jpg' };
        expect(boardingPassHref(leg)).toBe('https://x/a.jpg');
        expect(isPdfBoardingPass(leg)).toBe(false);
    });

    it('returns null without a boarding pass', () => {
        expect(boardingPassHref({ ...base, boarding_pass_path: null })).toBeNull();
    });
});
