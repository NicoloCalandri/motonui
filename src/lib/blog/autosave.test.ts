import { describe, expect, it, vi } from 'vitest';
import { autoSavePost } from './autosave';
import type { TiptapDoc } from '@/lib/types';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';
const DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ciao' }] }] };

describe('autoSavePost', () => {
    it('sends the content with PUT, the method the post route handles', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

        await expect(autoSavePost(TRIP_ID, POST_ID, DOC, fetchImpl)).resolves.toBe(true);

        expect(fetchImpl).toHaveBeenCalledWith(`/api/trips/${TRIP_ID}/posts/${POST_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content_json: DOC }),
        });
    });

    it('reports a rejected save instead of treating any response as saved', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 405 }));

        await expect(autoSavePost(TRIP_ID, POST_ID, DOC, fetchImpl)).resolves.toBe(false);
    });

    it('reports a network failure', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(autoSavePost(TRIP_ID, POST_ID, DOC, fetchImpl)).resolves.toBe(false);
    });

    it('does not call the API for a post that has never been saved', async () => {
        const fetchImpl = vi.fn();

        await expect(autoSavePost(TRIP_ID, 'new', DOC, fetchImpl)).resolves.toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
