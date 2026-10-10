import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { queryChain, type QueryChain } from '@/test/supabase-mock';
import { getPublishedPost, listPublishedPosts, listRelatedPosts, listSitemapPosts } from './public-posts';

function client(chain: QueryChain) {
    const from = vi.fn(() => chain);
    return { supabase: { from } as unknown as SupabaseClient<Database>, from };
}

describe('public blog queries (T-5.1, T-5.2)', () => {
    it('lists only published posts, newest first, without author ids', async () => {
        const chain = queryChain({ data: [{ id: 'p1', slug: 'rapa-nui' }], error: null });
        const { supabase, from } = client(chain);

        const posts = await listPublishedPosts(supabase);

        expect(from).toHaveBeenCalledWith('posts');
        expect(posts).toEqual([{ id: 'p1', slug: 'rapa-nui' }]);
        expect(chain.calls).toContainEqual(['eq', ['status', 'published']]);
        expect(chain.calls).toContainEqual(['order', ['published_at', { ascending: false }]]);
        const [, [columns]] = chain.calls.find(([m]) => m === 'select')!;
        expect(columns).not.toMatch(/author_id|\*/);
    });

    it('returns null for a missing or unpublished slug', async () => {
        const { supabase } = client(queryChain({ data: null, error: null }));
        expect(await getPublishedPost(supabase, 'bozza')).toBeNull();
    });

    it('filters a post by slug and published status', async () => {
        const chain = queryChain({ data: { id: 'p1', slug: 'rapa-nui' }, error: null });
        const { supabase } = client(chain);

        expect(await getPublishedPost(supabase, 'rapa-nui')).toMatchObject({ id: 'p1' });
        expect(chain.calls).toContainEqual(['eq', ['slug', 'rapa-nui']]);
        expect(chain.calls).toContainEqual(['eq', ['status', 'published']]);
    });

    it('skips the related query for a post without a trip', async () => {
        const { supabase, from } = client(queryChain());
        expect(await listRelatedPosts(supabase, { id: 'p1', trip_id: null })).toEqual([]);
        expect(from).not.toHaveBeenCalled();
    });

    it('lists other published posts of the same trip', async () => {
        const chain = queryChain({ data: [{ id: 'p2' }], error: null });
        const { supabase } = client(chain);

        expect(await listRelatedPosts(supabase, { id: 'p1', trip_id: 't1' })).toEqual([{ id: 'p2' }]);
        expect(chain.calls).toContainEqual(['eq', ['trip_id', 't1']]);
        expect(chain.calls).toContainEqual(['neq', ['id', 'p1']]);
        expect(chain.calls).toContainEqual(['limit', [3]]);
    });

    it('lists sitemap entries and tolerates a failed query', async () => {
        const ok = client(queryChain({ data: [{ slug: 'a', updated_at: '2026-01-01', published_at: '2026-01-01' }], error: null }));
        expect(await listSitemapPosts(ok.supabase)).toHaveLength(1);

        const failed = client(queryChain({ data: null, error: { message: 'down' } }));
        expect(await listSitemapPosts(failed.supabase)).toEqual([]);
    });
});
