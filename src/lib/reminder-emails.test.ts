import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryChain } from '@/test/supabase-mock';
import type { Database } from '@/lib/supabase/database.types';
import { buildReminderEmail, loadReminderEntities, type ReminderEntities, type ReminderRow } from './reminder-emails';

function reminder(overrides: Partial<ReminderRow>): ReminderRow {
    return {
        id: 'r-1',
        trip_id: 't-1',
        user_id: 'u-1',
        entity_type: 'leg',
        entity_id: 'e-1',
        type: 'flight_checkin',
        remind_at: '2026-10-01T08:00:00Z',
        sent_at: null,
        title: 'Promemoria',
        message: null,
        created_at: '2026-09-01T00:00:00Z',
        ...overrides,
    };
}

const empty = (): ReminderEntities => ({
    legs: new Map(),
    accommodations: new Map(),
    restaurants: new Map(),
    activities: new Map(),
});

describe('loadReminderEntities', () => {
    it('queries each entity table once, only for the types present', async () => {
        const from = vi.fn((table: string) =>
            queryChain({
                data: table === 'legs'
                    ? [{ id: 'l-1', from_name: 'Roma', to_name: 'Santiago' }]
                    : [{ id: 'a-1', name: 'Hotel Hanga Roa', booking_ref: null }],
                error: null,
            }),
        );
        const admin = { from } as unknown as SupabaseClient<Database>;

        const entities = await loadReminderEntities(admin, [
            reminder({ entity_type: 'leg', entity_id: 'l-1' }),
            reminder({ id: 'r-2', entity_type: 'leg', entity_id: 'l-1' }),
            reminder({ id: 'r-3', entity_type: 'accommodation', entity_id: 'a-1', type: 'payment_deadline' }),
        ]);

        expect(from.mock.calls.map(([table]) => table).sort()).toEqual(['accommodations', 'legs']);
        expect(entities.legs.get('l-1')?.to_name).toBe('Santiago');
        expect(entities.accommodations.get('a-1')?.name).toBe('Hotel Hanga Roa');
        expect(entities.restaurants.size).toBe(0);
    });

    it('makes no query without reminders', async () => {
        const from = vi.fn();
        const entities = await loadReminderEntities({ from } as unknown as SupabaseClient<Database>, []);
        expect(from).not.toHaveBeenCalled();
        expect(entities.legs.size).toBe(0);
    });
});

describe('buildReminderEmail', () => {
    it('builds the flight check-in email from the leg', () => {
        const entities = empty();
        entities.legs.set('e-1', {
            id: 'e-1', from_name: 'Roma, Italia', to_name: 'Santiago, Cile', carrier: null, pnr: null,
            booking_ref: 'ABC123', departure_at: '2026-10-02T10:00:00Z', checkin_opens_at: '2026-10-01T10:00:00Z',
        });

        const email = buildReminderEmail(reminder({}), entities, 'nicolo');

        expect(email?.subject).toBe('✈️ Check-in aperto: Roma → Santiago');
        expect(email?.html).toContain('ABC123');
    });

    it('distinguishes payment and cancellation deadlines', () => {
        const entities = empty();
        entities.accommodations.set('e-1', { id: 'e-1', name: 'Hotel Hanga Roa', booking_ref: null });

        const pay = buildReminderEmail(reminder({ entity_type: 'accommodation', type: 'payment_deadline' }), entities, 'g');
        const cancel = buildReminderEmail(reminder({ entity_type: 'accommodation', type: 'cancellation_deadline' }), entities, 'g');

        expect(pay?.subject).toBe('💳 Scadenza pagamento: Hotel Hanga Roa');
        expect(cancel?.subject).toBe('⚠️ Scadenza cancellazione: Hotel Hanga Roa');
    });

    it('builds restaurant and activity emails', () => {
        const entities = empty();
        const booking = { id: 'e-1', name: 'Te Moana', booking_ref: null, date: '2026-10-03', time: '20:00' };
        entities.restaurants.set('e-1', booking);
        entities.activities.set('e-1', { ...booking, name: 'Rano Raraku' });

        expect(buildReminderEmail(reminder({ entity_type: 'restaurant', type: 'restaurant_reservation' }), entities, 'g')?.subject)
            .toBe('🍽️ Prenotazione ristorante: Te Moana');
        expect(buildReminderEmail(reminder({ entity_type: 'activity', type: 'activity_ticket' }), entities, 'g')?.subject)
            .toBe('🎟️ Ci siamo quasi: Rano Raraku');
    });

    it('returns null when the entity is gone or the pair is unknown', () => {
        expect(buildReminderEmail(reminder({}), empty(), 'g')).toBeNull();
        expect(buildReminderEmail(reminder({ type: 'payment_deadline', entity_type: 'leg' }), empty(), 'g')).toBeNull();
    });
});
