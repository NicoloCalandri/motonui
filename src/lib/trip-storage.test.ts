// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Media } from '@/lib/types';

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: createAdminClientMock }));

import { removeLegFiles, removeMediaFiles, removeTripFiles, SIGNED_URL_TTL_SECONDS, withSignedUrls } from './trip-storage';

const TRIP = '10000000-0000-0000-0000-00000000000a';
const OTHER = '10000000-0000-0000-0000-00000000000c';

type Entry = { id: string | null; name: string };

/** Storage mock: one fake bucket per name, listing from a path → entries tree. */
function storage(tree: Record<string, Record<string, Entry[]>> = {}) {
    const removed: Record<string, string[]> = {};
    const buckets: Record<string, { list: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; createSignedUrls: ReturnType<typeof vi.fn> }> = {};
    const from = vi.fn((bucket: string) => {
        buckets[bucket] ??= {
            list: vi.fn(async (prefix: string) => ({ data: tree[bucket]?.[prefix] ?? [], error: null })),
            remove: vi.fn(async (paths: string[]) => {
                (removed[bucket] ??= []).push(...paths);
                return { data: [], error: null };
            }),
            createSignedUrls: vi.fn(async (paths: string[]) => ({
                data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
                error: null,
            })),
        };
        return buckets[bucket];
    });
    return { client: { storage: { from } }, removed, buckets };
}

function media(overrides: Partial<Media>): Media {
    return {
        id: 'm', created_at: '', updated_at: '', trip_id: TRIP, day_id: null, uploaded_by: 'u',
        url: null, thumbnail_url: null, storage_path: null, thumb_path: null, width: null, height: null,
        size: null, mime_type: null, caption: null, tags: [], taken_at: null, gps_lat: null, gps_lng: null,
        camera: null, sort_order: 0, ...overrides,
    };
}

describe('withSignedUrls', () => {
    it('signs only paths inside the trip, for one hour, with the caller client', async () => {
        const { client, buckets } = storage();
        const own = `trips/${TRIP}/original/a.jpg`;
        const thumb = `trips/${TRIP}/thumbs/a.webp`;
        const foreign = `trips/${OTHER}/original/b.jpg`;

        const rows = await withSignedUrls(client as unknown as SupabaseClient, TRIP, [
            media({ id: '1', storage_path: own, thumb_path: thumb }),
            media({ id: '2', storage_path: foreign }),
            media({ id: '3', url: 'https://example.com/x.jpg' }),
        ]);

        expect(buckets['trip-media'].createSignedUrls).toHaveBeenCalledWith([own, thumb], SIGNED_URL_TTL_SECONDS);
        expect(rows[0]).toMatchObject({ signed_url: `https://signed/${own}`, signed_thumb_url: `https://signed/${thumb}` });
        expect(rows[1]).toMatchObject({ signed_url: null, signed_thumb_url: null });
        expect(rows[2]).toMatchObject({ signed_url: null, url: 'https://example.com/x.jpg' });
    });

    it('does not call storage when there is nothing to sign', async () => {
        const { client } = storage();
        await withSignedUrls(client as unknown as SupabaseClient, TRIP, [media({ url: 'https://example.com/x.jpg' })]);
        expect(client.storage.from).not.toHaveBeenCalled();
    });
});

describe('file removal', () => {
    beforeEach(() => createAdminClientMock.mockReset());

    it('never removes media paths outside the trip', async () => {
        const { client, removed } = storage();
        createAdminClientMock.mockResolvedValue(client);

        await removeMediaFiles(TRIP, { storage_path: `trips/${OTHER}/original/b.jpg`, thumb_path: `trips/${TRIP}/thumbs/a.webp` });

        expect(removed['trip-media']).toEqual([`trips/${TRIP}/thumbs/a.webp`]);
    });

    it('removes the private and legacy boarding pass of a leg', async () => {
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
        const { client, removed } = storage();
        createAdminClientMock.mockResolvedValue(client);

        await removeLegFiles(TRIP, {
            boarding_pass_path: `trips/${TRIP}/boarding-passes/leg-1.pdf`,
            boarding_pass_url: `https://abc.supabase.co/storage/v1/object/public/trip-media/trips/${TRIP}/boarding-passes/leg-0.pdf`,
        });

        expect(removed['trip-documents']).toEqual([`trips/${TRIP}/boarding-passes/leg-1.pdf`]);
        expect(removed['trip-media']).toEqual([`trips/${TRIP}/boarding-passes/leg-0.pdf`]);
        vi.unstubAllEnvs();
    });

    it('removes every file of a trip across buckets, walking folders', async () => {
        const root = `trips/${TRIP}`;
        const { client, removed } = storage({
            'trip-media': {
                [root]: [{ id: null, name: 'original' }, { id: null, name: 'thumbs' }],
                [`${root}/original`]: [{ id: '1', name: 'a.jpg' }, { id: '2', name: 'b.jpg' }],
                [`${root}/thumbs`]: [{ id: '3', name: 'a.webp' }],
            },
            'trip-documents': {
                [root]: [{ id: null, name: 'documents' }],
                [`${root}/documents`]: [{ id: '4', name: 'd.pdf' }],
            },
            'instagram-exports': { [TRIP]: [{ id: '5', name: 'e.zip' }] },
        });
        createAdminClientMock.mockResolvedValue(client);

        expect(await removeTripFiles(TRIP)).toBe(5);
        expect(removed['trip-media']).toEqual([`${root}/original/a.jpg`, `${root}/original/b.jpg`, `${root}/thumbs/a.webp`]);
        expect(removed['trip-documents']).toEqual([`${root}/documents/d.pdf`]);
        expect(removed['instagram-exports']).toEqual([`${TRIP}/e.zip`]);
    });
});
