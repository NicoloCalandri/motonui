// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EXPORT_TTL_MS, removeExpiredExportObjects } from './instagram-cleanup';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const OLD = new Date(NOW - EXPORT_TTL_MS - 60_000).toISOString();
const FRESH = new Date(NOW - 60_000).toISOString();

type Entry = { id: string | null; name: string; created_at?: string };

function storageMock(tree: Record<string, Entry[]>) {
    const remove = vi.fn(async (paths: string[]) => ({ data: paths, error: null }));
    const list = vi.fn(async (prefix: string) => ({ data: tree[prefix] ?? [], error: null }));
    const client = { storage: { from: vi.fn(() => ({ list, remove })) } } as unknown as SupabaseClient;
    return { client, remove, list };
}

describe('removeExpiredExportObjects', () => {
    it('removes ZIPs older than 24 h in every trip folder, orphans included, and keeps fresh ones', async () => {
        const { client, remove } = storageMock({
            '': [{ id: null, name: 'trip-a' }, { id: null, name: 'trip-b' }],
            'trip-a': [
                { id: '1', name: 'old.zip', created_at: OLD },
                { id: '2', name: 'fresh.zip', created_at: FRESH },
            ],
            'trip-b': [{ id: '3', name: 'orphan.zip', created_at: OLD }],
        });

        expect(await removeExpiredExportObjects(client, NOW)).toBe(2);
        expect(remove).toHaveBeenCalledWith(['trip-a/old.zip']);
        expect(remove).toHaveBeenCalledWith(['trip-b/orphan.zip']);
        expect(remove.mock.calls.flat(2)).not.toContain('trip-a/fresh.zip');
    });

    it('does nothing on an empty bucket', async () => {
        const { client, remove } = storageMock({ '': [] });
        expect(await removeExpiredExportObjects(client, NOW)).toBe(0);
        expect(remove).not.toHaveBeenCalled();
    });

    it('surfaces storage errors instead of reporting success', async () => {
        const list = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
        const client = { storage: { from: () => ({ list, remove: vi.fn() }) } } as unknown as SupabaseClient;
        await expect(removeExpiredExportObjects(client, NOW)).rejects.toThrow('boom');
    });
});
