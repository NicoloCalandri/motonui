import type { TiptapDoc } from '@/lib/types';

/** The edit page uses this id until the first manual save creates the row. */
const NEW_POST_ID = 'new';

/**
 * Saves the editor content of a post. Returns whether the API accepted it:
 * a non-2xx response is a failed save, not a saved one.
 * A post that has never been saved has no row to update, so it is skipped.
 */
export async function autoSavePost(
    tripId: string,
    postId: string,
    content: TiptapDoc,
    fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
    if (postId === NEW_POST_ID) return false;
    try {
        const res = await fetchImpl(`/api/trips/${tripId}/posts/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content_json: content }),
        });
        return res.ok;
    } catch {
        return false;
    }
}
