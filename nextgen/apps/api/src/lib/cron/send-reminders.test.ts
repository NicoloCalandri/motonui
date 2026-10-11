import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
    reminders: [] as Array<Record<string, unknown>>,
    accommodations: [] as Array<Record<string, unknown>>,
    updates: [] as Array<{ id: unknown; payload: Record<string, unknown> }>,
    emails: {} as Record<string, string | null>,
    selects: [] as Array<{ table: string; columns: string }>,
}));

vi.mock('../email', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../email')>()),
    sendEmail: mocks.sendEmail,
}));

vi.mock('../supabase/server', () => ({
    createAdminClient: () => ({
        auth: { admin: { getUserById: async (id: string) => ({ data: { user: mocks.emails[id] ? { email: mocks.emails[id] } : null } }) } },
        from: (table: string) => {
            let payload: Record<string, unknown> | null = null;
            const rows = table === 'reminders' ? mocks.reminders : table === 'accommodations' ? mocks.accommodations : [];
            const chain: Record<string, unknown> = {};
            chain.select = (columns: string) => {
                mocks.selects.push({ table, columns });
                return chain;
            };
            for (const method of ['lte', 'is', 'in', 'order']) chain[method] = () => chain;
            chain.update = (value: Record<string, unknown>) => {
                payload = value;
                return chain;
            };
            chain.eq = (_column: string, id: unknown) => {
                if (payload) mocks.updates.push({ id, payload });
                return chain;
            };
            chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
            return chain;
        },
    }),
}));

import { runSendReminders } from './send-reminders';

function reminder(overrides: Record<string, unknown> = {}) {
    return {
        id: 'r-1', trip_id: 't-1', user_id: 'u-1', entity_type: 'accommodation', entity_id: 'a-1',
        type: 'payment_deadline', remind_at: '2026-10-07T00:00:00Z', sent_at: null,
        title: 'Promemoria', message: null, created_at: '2026-09-01T00:00:00Z',
        ...overrides,
    };
}

describe('runSendReminders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.reminders = [];
        mocks.accommodations = [{ id: 'a-1', name: 'Hotel Hanga Roa', booking_ref: null, payment_deadline: '2026-10-10', cancellation_deadline: null }];
        mocks.updates = [];
        mocks.selects = [];
        mocks.emails = { 'u-1': 'giorgia@example.com' };
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('sends the deadline of the accommodation, not the day the reminder fires', async () => {
        mocks.reminders = [reminder()];

        const result = await runSendReminders();

        expect(result).toMatchObject({ success: true, sent: 1, failed: 0 });
        const [message] = mocks.sendEmail.mock.calls[0] as [{ to: string; subject: string; html: string }];
        expect(message.to).toBe('giorgia@example.com');
        expect(message.subject).toBe('💳 Scadenza pagamento: Hotel Hanga Roa');
        expect(message.html).toContain('sabato 10 ottobre 2026');
        expect(message.html).not.toContain('07 ottobre');
    });

    it('marks a sent reminder, and only that one', async () => {
        mocks.reminders = [reminder(), reminder({ id: 'r-2', entity_id: 'gone' })];

        const result = await runSendReminders();

        expect(result).toMatchObject({ sent: 1 });
        expect(mocks.updates.map((update) => update.id)).toEqual(['r-1']);
        expect(mocks.updates[0].payload).toHaveProperty('sent_at');
    });

    it('skips a reminder whose entity is gone or whose user has no email', async () => {
        mocks.reminders = [reminder({ entity_id: 'gone' }), reminder({ id: 'r-3', user_id: 'nobody' })];

        const result = await runSendReminders();

        expect(result).toMatchObject({ sent: 0, failed: 0 });
        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.updates).toEqual([]);
    });

    it('counts a failed send, keeps going, and leaves the failed reminder unsent', async () => {
        mocks.reminders = [reminder(), reminder({ id: 'r-4' })];
        mocks.sendEmail.mockRejectedValueOnce(new Error('smtp down')).mockResolvedValueOnce(undefined);

        const result = await runSendReminders();

        expect(result).toMatchObject({ sent: 1, failed: 1 });
        expect(mocks.updates.map((update) => update.id)).toEqual(['r-4']);
    });

    it('does not embed the polymorphic entity in the reminders query', async () => {
        mocks.reminders = [reminder()];

        await runSendReminders();

        const query = mocks.selects.find((select) => select.table === 'reminders');
        expect(query?.columns).toBe('*');
    });
});
