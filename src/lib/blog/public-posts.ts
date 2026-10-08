import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

/**
 * Read-only queries for the public blog (T-5.1, T-5.2). Callers pass the
 * anonymous client (`createPublicClient`), so only published posts are
 * visible (RLS `posts_select_published`). Columns are listed explicitly:
 * the author id never reaches the page.
 */
type Db = SupabaseClient<Database>;

/** Destination of the post's trip; null for anonymous readers (trips RLS). */
type TripRef = { destination: string } | null;

export type PublicPostCard = {
    id: string;
    title: string;
    slug: string;
    cover_image: string | null;
    published_at: string | null;
    reading_time: number | null;
    seo_description: string | null;
    trips: TripRef;
};

export type PublicPost = PublicPostCard & {
    trip_id: string | null;
    content_json: Json | null;
    seo_title: string | null;
    og_description: string | null;
};

export type RelatedPost = Pick<PublicPostCard, 'id' | 'title' | 'slug' | 'cover_image' | 'reading_time' | 'published_at'>;

export type SitemapPost = { slug: string; updated_at: string; published_at: string | null };

const CARD_COLUMNS = 'id, title, slug, cover_image, published_at, reading_time, seo_description, trips (destination)';
const POST_COLUMNS = `${CARD_COLUMNS}, trip_id, content_json, seo_title, og_description`;

export async function listPublishedPosts(supabase: Db): Promise<PublicPostCard[]> {
    const { data } = await supabase
        .from('posts')
        .select(CARD_COLUMNS)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
    return (data ?? []) as unknown as PublicPostCard[];
}

export async function getPublishedPost(supabase: Db, slug: string): Promise<PublicPost | null> {
    const { data } = await supabase
        .from('posts')
        .select(POST_COLUMNS)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
    return (data as unknown as PublicPost | null) ?? null;
}

export async function listRelatedPosts(supabase: Db, post: Pick<PublicPost, 'id' | 'trip_id'>, limit = 3): Promise<RelatedPost[]> {
    if (!post.trip_id) return [];
    const { data } = await supabase
        .from('posts')
        .select('id, title, slug, cover_image, reading_time, published_at')
        .eq('trip_id', post.trip_id)
        .eq('status', 'published')
        .neq('id', post.id)
        .limit(limit);
    return (data ?? []) as RelatedPost[];
}

/** Published posts for /sitemap.xml, newest first. */
export async function listSitemapPosts(supabase: Db): Promise<SitemapPost[]> {
    const { data } = await supabase
        .from('posts')
        .select('slug, updated_at, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
    return (data ?? []) as SitemapPost[];
}
