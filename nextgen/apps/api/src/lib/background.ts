import { captureError } from './monitoring';

/**
 * Work that continues after the response has been sent: the counterpart of
 * `after()` in the Next.js app. It relies on the API being a long-running
 * Node process, like the in-process scheduler (src/scheduler.ts). On a
 * platform that freezes the process once the response is out, this is the
 * one function to rewrite (e.g. on the platform's `waitUntil`).
 *
 * The task inherits the request id of the request that started it, so its
 * log lines can be tied back to that request.
 */

const pending = new Set<Promise<void>>();

export function runInBackground(name: string, task: () => Promise<void> | void): void {
    const run = Promise.resolve()
        .then(task)
        .catch((error: unknown) => {
            captureError(error, { route: `background:${name}` });
        })
        .finally(() => {
            pending.delete(run);
        });
    pending.add(run);
}

/** Resolves when every task started so far has settled. For tests and for a clean shutdown. */
export async function backgroundIdle(): Promise<void> {
    while (pending.size > 0) await Promise.all(pending);
}
