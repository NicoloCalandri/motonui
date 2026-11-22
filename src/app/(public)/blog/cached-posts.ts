import { revalidateTag, unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { getPublishedPost, listPublishedPosts, listRelatedPosts, listSitemapPosts } from '@/lib/blog/public-posts';

/**
 * Public blog reads, cached across requests (audit B1.33). The pages render
 * per request because of the CSP nonce (src/app/layout.tsx), so route-level
 * `revalidate` caches nothing: the data cache does. The queries use the
 * anonymous client (no cookies, published posts only), so one cached result
 * is the same for every reader.
 *
 * Fresh within REVALIDATE_SECONDS anyway; a write to a post invalidates the
 * tag at once (revalidateBlog, called by the post routes).
 */
export const BLOG_CACHE_TAG = 'blog-posts';
const REVALIDATE_SECONDS = 300;
const options = { revalidate: REVALIDATE_SECONDS, tags: [BLOG_CACHE_TAG] };

export const cachedPublishedPosts = unstable_cache(
    async () => listPublishedPosts(createPublicClient()),
    ['blog', 'published-posts'],
    options,
);

export const cachedPublishedPost = unstable_cache(
    async (slug: string) => getPublishedPost(createPublicClient(), slug),
    ['blog', 'published-post'],
    options,
);

export const cachedRelatedPosts = unstable_cache(
    async (postId: string, tripId: string | null) => listRelatedPosts(createPublicClient(), { id: postId, trip_id: tripId }),
    ['blog', 'related-posts'],
    options,
);

export const cachedSitemapPosts = unstable_cache(
    async () => listSitemapPosts(createPublicClient()),
    ['blog', 'sitemap-posts'],
    options,
);

/** Marks every cached blog read stale; the next visit refetches in the background. */
export function revalidateBlog(): void {
    revalidateTag(BLOG_CACHE_TAG, 'max');
}
