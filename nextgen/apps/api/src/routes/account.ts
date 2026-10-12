import { Hono } from 'hono';
import { z } from 'zod';
import { withErrorHandler, ok, readJsonObject, issueSummary } from '../lib/http';
import { AppError, Errors } from '../lib/errors';
import { log } from '../lib/log';
import { drainStorageDeletionQueue } from '../lib/storage-deletion';
import { createAdminClient } from '../lib/supabase/server';
import { requireUser } from '../middleware/auth';
import { loadProfile } from '../middleware/profile';
import type { AppEnv } from '../types';

// Mounted at /api/account. Port of src/app/api/account/delete/route.ts.
export const accountRouter = new Hono<AppEnv>();

const DeleteAccountSchema = z.object({
    confirm: z.literal('ELIMINA', { errorMap: () => ({ message: 'scrivi ELIMINA per confermare' }) }),
});

/**
 * POST /api/account/delete — self-service account deletion.
 * delete_my_account() runs with the user's JWT: shared trips pass to the
 * partner, solo trips are deleted, files are queued; the queue is then
 * drained here with the Storage API so nothing waits for the nightly cron.
 *
 * The web app drops its own session after the call: with bearer tokens the
 * server has no cookie to clear.
 */
accountRouter.post(
    '/delete',
    requireUser,
    loadProfile,
    withErrorHandler(async (c) => {
        const parsed = DeleteAccountSchema.safeParse(await readJsonObject(c));
        if (!parsed.success) throw Errors.validation(issueSummary(parsed.error));

        const { data, error } = await c.get('supabase').rpc('delete_my_account', { confirm_text: 'DELETE' });
        if (error) {
            log.error('[motonui][account][delete]', error.message);
            throw new AppError('Non riusciamo a eliminare l’account. Riprova tra poco 🏝️', 'ACCOUNT_DELETE_FAILED', 500);
        }

        try {
            await drainStorageDeletionQueue(createAdminClient());
        } catch (err) {
            // The account is gone; leftover files stay queued for the cron.
            log.error('[motonui][account][delete] storage cleanup deferred', err);
        }

        return ok(c, { deleted: true, ...(data && typeof data === 'object' ? data : {}) });
    }, 'account/delete POST')
);
