// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryChain } from '@/test/supabase-mock';
import { drainStorageDeletionQueue } from './storage-deletion';

function adminWith(rows: object[], failingBucket?: string) {
    const read = queryChain({ data: rows, error: null });
    const dequeue = queryChain({ data: null, error: null });
    const removed: Record<string, string[]> = {};
    let reads = 0;
    const client = {
        from: vi.fn(() => (reads++ === 0 ? read : dequeue)),
        storage: {
            from: vi.fn((bucket: string) => ({
                remove: vi.fn(async (paths: string[]) => {
                    if (bucket === failingBucket) return { data: null, error: { message: 'down' } };
                    (removed[bucket] ??= []).push(...paths);
                    return { data: [], error: null };
                }),
            })),
        },
    } as unknown as SupabaseClient;
    return { client, removed, dequeue };
}

describe('drainStorageDeletionQueue', () => {
    it('removes queued objects per bucket and dequeues them', async () => {
        const { client, removed, dequeue } = adminWith([
            { id: 1, bucket_id: 'trip-media', name: 'trips/t/original/a.webp' },
            { id: 2, bucket_id: 'avatars', name: 'u/avatar.png' },
            { id: 3, bucket_id: 'trip-media', name: 'trips/t/thumbs/a.webp' },
        ]);

        expect(await drainStorageDeletionQueue(client)).toBe(3);
        expect(removed).toEqual({
            'trip-media': ['trips/t/original/a.webp', 'trips/t/thumbs/a.webp'],
            avatars: ['u/avatar.png'],
        });
        expect(dequeue.calls).toContainEqual(['in', ['id', [1, 3]]]);
        expect(dequeue.calls).toContainEqual(['in', ['id', [2]]]);
    });

    it('keeps objects in the queue when the Storage API fails, for the next run', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { client, removed, dequeue } = adminWith(
            [
                { id: 1, bucket_id: 'trip-media', name: 'a' },
                { id: 2, bucket_id: 'avatars', name: 'b' },
            ],
            'trip-media',
        );

        expect(await drainStorageDeletionQueue(client)).toBe(1);
        expect(removed).toEqual({ avatars: ['b'] });
        expect(dequeue.calls).not.toContainEqual(['in', ['id', [1]]]);
    });
});
