import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ captureError: vi.fn() }));

vi.mock('./monitoring', () => ({ captureError: mocks.captureError }));

import { backgroundIdle, runInBackground } from './background';
import { log } from './log';
import { runWithRequestId } from './request-context';

describe('runInBackground', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns before the task has finished', async () => {
        let finished = false;
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        runInBackground('test', async () => {
            await gate;
            finished = true;
        });

        expect(finished).toBe(false);
        release();
        await backgroundIdle();
        expect(finished).toBe(true);
    });

    it('reports a failed task instead of leaving an unhandled rejection', async () => {
        const failure = new Error('boom');

        runInBackground('instagram-export', async () => {
            throw failure;
        });
        await backgroundIdle();

        expect(mocks.captureError).toHaveBeenCalledWith(failure, expect.objectContaining({ route: 'background:instagram-export' }));
    });

    it('reports a task that throws before its first await', async () => {
        runInBackground('sync', () => {
            throw new Error('early');
        });
        await backgroundIdle();

        expect(mocks.captureError).toHaveBeenCalledTimes(1);
    });

    it('keeps the request id of the request that started the task', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});

        await runWithRequestId('req-123', async () => {
            runInBackground('test', async () => {
                await Promise.resolve();
                log.info('[motonui][test] background line');
            });
        });
        await backgroundIdle();

        expect(JSON.parse(String(info.mock.calls[0][0]))).toMatchObject({ request_id: 'req-123' });
    });
});
