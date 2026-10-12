import { beforeEach, describe, expect, it, vi } from 'vitest';

const CRON_SECRET = 'c'.repeat(32);

const mocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
    reminders: [] as Array<Record<string, unknown>>,
    accommodations: [] as Array<Record<string, unknown>>,
    updates: [] as Array<{ id: unknown; payload: Record<string, unknown> }>,
    emails: {} as Record<string, string | null>,
    updateError: null as null | { message: string },
}));

vi.mock('@/lib/email', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/email')>()),
    sendEmail: mocks.sendEmail,
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: async () => ({
        auth: { admin: { getUserById: async (id: string) => ({ data: { user: mocks.emails[id] ? { email: mocks.emails[id] } : null } }) } },
        from: (table: string) => {
            let payload: Record<string, unknown> | null = null;
            const rows = table === 'reminders' ? mocks.reminders : table === 'accommodations' ? mocks.accommodations : [];
            const chain: Record<string, unknown> = {};
            for (const method of ['select', 'lte', 'is', 'in', 'order']) chain[method] = () => chain;
            chain.update = (value: Record<string, unknown>) => {
                payload = value;
                return chain;
            };
            chain.eq = (_column: string, id: unknown) => {
                if (payload) mocks.updates.push({ id, payload });
                return chain;
            };
            chain.then = (resolve: (value: unknown) => unknown) =>
                Promise.resolve(payload ? { data: null, error: mocks.updateError } : { data: rows, error: null }).then(resolve);
            return chain;
        },
    }),
}));

import { GET } from './route';

function reminder(overrides: Record<string, unknown> = {}) {
    return {
        id: 'r-1', trip_id: 't-1', user_id: 'u-1', entity_type: 'accommodation', entity_id: 'a-1',
        type: 'payment_deadline', remind_at: '2026-10-07T00:00:00Z', sent_at: null,
        title: 'Promemoria', message: null, created_at: '2026-09-01T00:00:00Z',
        ...overrides,
    };
}

async function run(authorization = `Bearer ${CRON_SECRET}`) {
    const response = await GET(new Request('http://localhost/api/admin/send-reminders', { headers: { authorization } }));
    return { status: response.status, body: await response.json() };
}

describe('GET /api/admin/send-reminders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.reminders = [];
        mocks.accommodations = [{ id: 'a-1', name: 'Hotel Hanga Roa', booking_ref: null, payment_deadline: '2026-10-10', cancellation_deadline: null }];
        mocks.updates = [];
        mocks.emails = { 'u-1': 'giorgia@example.com' };
        mocks.updateError = null;
        vi.unstubAllEnvs();
        vi.stubEnv('CRON_SECRET', CRON_SECRET);
        vi.stubEnv('RESEND_API_KEY', 'test-key');
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('rejects a call without the cron secret', async () => {
        mocks.reminders = [reminder()];

        const { status } = await run('Bearer wrong');

        expect(status).toBe(401);
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('sends a due reminder and marks it as sent', async () => {
        mocks.reminders = [reminder()];

        const { status, body } = await run();

        expect(status).toBe(200);
        expect(body).toMatchObject({ success: true, sent: 1, failed: 0 });
        expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
        expect(mocks.updates.map((update) => update.id)).toEqual(['r-1']);
        expect(mocks.updates[0].payload).toHaveProperty('sent_at');
    });

    it('sends nothing and marks nothing when email is not configured', async () => {
        vi.stubEnv('RESEND_API_KEY', '');
        mocks.reminders = [reminder()];

        const { body } = await run();

        // Without a provider sendEmail is a no-op: marking the reminder would lose it for good.
        expect(body).toMatchObject({ sent: 0, failed: 0 });
        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.updates).toEqual([]);
    });

    it('counts a reminder as failed when it cannot be marked as sent', async () => {
        mocks.reminders = [reminder()];
        mocks.updateError = { message: 'connection lost' };

        const { body } = await run();

        expect(body).toMatchObject({ sent: 0, failed: 1 });
    });

    it('counts a failed send, keeps going, and leaves the failed reminder unsent', async () => {
        mocks.reminders = [reminder(), reminder({ id: 'r-4' })];
        mocks.sendEmail.mockRejectedValueOnce(new Error('smtp down')).mockResolvedValueOnce(undefined);

        const { body } = await run();

        expect(body).toMatchObject({ sent: 1, failed: 1 });
        expect(mocks.updates.map((update) => update.id)).toEqual(['r-4']);
    });
});
