import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { getPublishedPost } from '@/lib/blog/public-posts';
import { OG_SIZE, PostOgCard } from '@/components/blog/post-og-card';

/**
 * Open Graph image for each post (T-5.4): a typographic card with the post
 * title, generated on request. The cover image is not embedded: it is a
 * user-supplied URL and fetching it server-side would be an SSRF path.
 */
export const alt = 'Anteprima del post sul blog di motonui';
export const size = OG_SIZE;
export const contentType = 'image/png';

interface Props {
    params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
    const { slug } = await params;
    const post = await getPublishedPost(createPublicClient(), slug);

    return new ImageResponse(
        (
            <PostOgCard
                title={post ? post.seo_title ?? post.title : 'motonui'}
                description={post ? post.og_description ?? post.seo_description : null}
                publishedAt={post?.published_at}
                readingTime={post?.reading_time}
            />
        ),
        { ...size, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
    );
}
