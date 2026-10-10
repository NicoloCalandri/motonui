import { describe, expect, it } from 'vitest';
import type { Leg } from '@/lib/types';
import { coordsOf, formValuesFromLeg, legTimes, segmentsPayload, type FormValues } from './leg-form';

const base: FormValues = { type: 'flight', from_name: 'Roma', to_name: 'Santiago', currency: 'EUR' };

describe('legTimes', () => {
    it('combines date and time, falling back to the drawer day', () => {
        expect(legTimes({ ...base, departure_time: '10:30', arrival_date: '2026-10-02', arrival_time: '06:00' }, '2026-10-01')).toEqual({
            departure_at: '2026-10-01T10:30:00',
            arrival_at: '2026-10-02T06:00:00',
            checkin_opens_at: null,
        });
    });

    it('uses the edited leg date and leaves times without a date empty', () => {
        const times = legTimes({ ...base, departure_time: '08:00', checkin_opens_at: '2026-09-30T08:00' }, undefined, {
            departure_at: '2026-10-05T12:00:00',
            arrival_at: null,
        });
        expect(times).toEqual({ departure_at: '2026-10-05T08:00:00', arrival_at: null, checkin_opens_at: '2026-09-30T08:00:00' });
    });
});

describe('segmentsPayload', () => {
    it('drops incomplete segments and nulls missing coordinates', () => {
        expect(segmentsPayload([
            { from_name: 'FCO — Roma', to_name: 'MAD — Madrid', from_lat: 41.8, from_lng: 12.2 },
            { from_name: 'MAD — Madrid', to_name: '' },
        ])).toEqual([{ from_name: 'FCO — Roma', to_name: 'MAD — Madrid', from_lat: 41.8, from_lng: 12.2, to_lat: null, to_lng: null }]);
    });
});

describe('formValuesFromLeg', () => {
    it('splits timestamps into date and time inputs', () => {
        const leg = {
            type: 'train', from_name: 'Torino', to_name: 'Milano', departure_at: '2026-10-01T09:15:00', arrival_at: null,
            cost: null, currency: 'EUR', carrier: 'Trenitalia', booking_ref: null, pnr: null, checkin_opens_at: null,
        } as unknown as Leg;
        expect(formValuesFromLeg(leg, '2026-10-01')).toMatchObject({
            departure_date: '2026-10-01', departure_time: '09:15', arrival_date: '2026-10-01', arrival_time: undefined, carrier: 'Trenitalia',
        });
    });
});

describe('coordsOf', () => {
    it('needs both coordinates, zero included', () => {
        expect(coordsOf(0, 0)).toEqual({ lat: 0, lng: 0 });
        expect(coordsOf(41.8, null)).toBeNull();
    });
});
