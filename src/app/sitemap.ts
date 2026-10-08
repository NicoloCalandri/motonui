import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { listSitemapPosts } from '@/lib/blog/public-posts';
import { getAppBaseUrl } from '@/lib/url';

// Rendered per request: a post published a minute ago is listed at once, and
// the build does not need to reach Supabase.
export const dynamic = 'force-dynamic';

/** /sitemap.xml (T-5.2): home, blog index and every published post. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = getAppBaseUrl();
    const posts = await listSitemapPosts(createPublicClient());
    const url = (path: string) => new URL(path, base).toString();

    return [
        { url: url('/'), changeFrequency: 'monthly', priority: 0.5 },
        {
            url: url('/blog'),
            lastModified: posts[0]?.published_at ?? undefined,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        ...posts.map((post) => ({
            url: url(`/blog/${post.slug}`),
            lastModified: post.updated_at,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
        })),
    ];
}
