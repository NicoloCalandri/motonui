import { z } from 'zod';
import { AppError, ok } from '@/lib/errors';
import { withRoute } from '@/lib/api/with-route';
import { createAdminClient } from '@/lib/supabase/server';
import { drainStorageDeletionQueue } from '@/lib/storage-deletion';

const DeleteAccountSchema = z.object({
    confirm: z.literal('ELIMINA', { errorMap: () => ({ message: 'scrivi ELIMINA per confermare' }) }),
});

/**
 * POST /api/account/delete — self-service account deletion (T-2.9).
 * delete_my_account() runs with the user's JWT: shared trips pass to the
 * partner, solo trips are deleted, files are queued; the queue is then
 * drained here with the Storage API so nothing waits for the nightly cron.
 */
export const POST = withRoute(
    { name: 'account/delete POST', body: DeleteAccountSchema },
    async ({ supabase }) => {
        const { data, error } = await supabase.rpc('delete_my_account', { confirm_text: 'DELETE' });
        if (error) {
            console.error('[motonui][account][delete]', error.message);
            throw new AppError('Non riusciamo a eliminare l’account. Riprova tra poco 🏝️', 'ACCOUNT_DELETE_FAILED', 500);
        }

        try {
            await drainStorageDeletionQueue(await createAdminClient());
        } catch (err) {
            // The account is gone; leftover files stay queued for the cron.
            console.error('[motonui][account][delete] storage cleanup deferred', err);
        }

        await supabase.auth.signOut();
        return ok({ deleted: true, ...(data && typeof data === 'object' ? data : {}) });
    },
);
