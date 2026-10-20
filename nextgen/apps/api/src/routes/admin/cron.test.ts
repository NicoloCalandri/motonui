import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ runCleanup: vi.fn(), runSendReminders: vi.fn() }));

vi.mock('../../lib/cron/cleanup', () => ({ runCleanup: mocks.runCleanup }));
vi.mock('../../lib/cron/send-reminders', () => ({ runSendReminders: mocks.runSendReminders }));

import { createApp } from '../../app';

// Low-entropy placeholder: gitleaks flags realistic-looking values.
const SECRET = 'x'.repeat(40);

const JOBS = [
    ['/api/admin/cleanup', mocks.runCleanup],
    ['/api/admin/send-reminders', mocks.runSendReminders],
] as const;

describe.each(JOBS)('cron route %s', (path, job) => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CRON_SECRET', SECRET);
        job.mockResolvedValue({ ok: true });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it.each(['GET', 'POST'])('runs the job on %s with the bearer secret', async (method) => {
        const res = await createApp().request(path, { method, headers: { authorization: `Bearer ${SECRET}` } });

        expect(res.status).toBe(200);
        expect(job).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['no header', {}],
        ['a wrong secret', { authorization: `Bearer ${'y'.repeat(40)}` }],
        ['the secret without the Bearer scheme', { authorization: SECRET }],
        ['the old x-admin-secret header', { 'x-admin-secret': SECRET }],
    ])('answers 401 and does not run the job with %s', async (_label, headers) => {
        const res = await createApp().request(path, { method: 'POST', headers: headers as Record<string, string> });

        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
        expect(job).not.toHaveBeenCalled();
    });

    it('fails closed when CRON_SECRET is missing or too short', async () => {
        vi.stubEnv('CRON_SECRET', 'short');
        const res = await createApp().request(path, { method: 'POST', headers: { authorization: 'Bearer short' } });

        expect(res.status).toBe(401);
        expect(job).not.toHaveBeenCalled();
    });

    it('does not send the failure message of the job to the caller', async () => {
        job.mockRejectedValue(new Error('smtp password rejected for ops@example.com'));

        const res = await createApp().request(path, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } });

        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('smtp');
    });
});
