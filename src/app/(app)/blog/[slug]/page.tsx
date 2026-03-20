import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Post } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, MapPin, ArrowLeft } from 'lucide-react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import ShareButton from '../_components/ShareButton';

// Revalidate every hour for caching
export const revalidate = 3600;

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const supabase = await createClient();

    const { data: post } = await supabase
        .from('posts')
        .select('title, seo_title, seo_description, cover_image')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

    if (!post) return { title: 'Post non trovato' };

    return {
        title: post.seo_title ?? post.title,
        description: post.seo_description ?? undefined,
        openGraph: {
            title: post.seo_title ?? post.title,
            description: post.seo_description ?? undefined,
            images: post.cover_image ? [post.cover_image] : [],
        },
    };
}

/**
 * Public blog post view — server component, no auth required.
 * Renders Tiptap JSON to HTML server-side for SEO.
 */
export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;
    const supabase = await createClient();

    const { data: post } = await supabase
        .from('posts')
        .select(`
      *, trips (id, destination, title)
    `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

    if (!post) notFound();

    // Fetch related posts from the same trip
    const { data: related } = post.trip_id
        ? await supabase
            .from('posts')
            .select('id, title, slug, cover_image, reading_time, published_at')
            .eq('trip_id', post.trip_id)
            .eq('status', 'published')
            .neq('id', post.id)
            .limit(3)
        : { data: [] };

    // Convert Tiptap JSON → HTML for server-side rendering
    let htmlContent = '';
    if (post.content_json) {
        try {
            htmlContent = generateHTML(post.content_json as Parameters<typeof generateHTML>[0], [
                StarterKit,
                TiptapImage,
                TiptapLink,
            ]);
        } catch {
            htmlContent = '<p>Contenuto non disponibile.</p>';
        }
    }

    const typedPost = post as Post & { trips: { destination: string; title: string } | null };

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
            {/* Top bar: back link + share */}
            <div className="flex items-center justify-between mb-8">
                <Link
                    href="/blog"
                    className="flex items-center gap-2 text-ink-500 hover:text-ink-900 text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Tutti i post
                </Link>
                <ShareButton title={typedPost.title} />
            </div>

            {/* Hero image */}
            {typedPost.cover_image && (
                <div className="relative h-64 md:h-96 overflow-hidden rounded-3xl mb-10">
                    <img
                        src={typedPost.cover_image}
                        alt={typedPost.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 hero-gradient" />
                </div>
            )}

            {/* Article content */}
            <article className="max-w-2xl mx-auto">
                {/* Meta */}
                {typedPost.trips?.destination && (
                    <div className="flex items-center gap-1.5 text-terracotta-400 text-sm mb-3">
                        <MapPin className="w-4 h-4" />
                        <Link href="/blog" className="hover:underline">{typedPost.trips.destination}</Link>
                    </div>
                )}

                <h1 className="font-display text-3xl md:text-5xl font-bold text-ink-900 mb-4 leading-tight">
                    {typedPost.title}
                </h1>

                <div className="flex items-center gap-4 text-ink-400 text-sm mb-10 pb-8 border-b border-sand-200">
                    {typedPost.published_at && (
                        <span>{format(new Date(typedPost.published_at), 'd MMMM yyyy', { locale: it })}</span>
                    )}
                    {typedPost.reading_time && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {typedPost.reading_time} minuti di lettura
                        </span>
                    )}
                </div>

                {/* Post body — Tiptap HTML */}
                {htmlContent ? (
                    <div
                        className="prose prose-lg prose-headings:font-display prose-headings:text-ink-900 prose-p:text-ink-700 prose-p:leading-relaxed prose-a:text-terracotta-500 prose-blockquote:border-terracotta-300 prose-blockquote:italic prose-img:rounded-2xl max-w-none"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                ) : (
                    <p className="text-ink-400 italic">Contenuto non disponibile.</p>
                )}
            </article>

            {/* Related posts */}
            {related && related.length > 0 && (
                <div className="border-t border-sand-200 mt-16 pt-12">
                    <h2 className="font-display text-2xl font-bold text-ink-900 mb-6">
                        Altri post dallo stesso viaggio
                    </h2>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {(related as Post[]).map((rel) => (
                            <Link key={rel.id} href={`/blog/${rel.slug}`} className="card group overflow-hidden hover:shadow-card-hover transition-shadow">
                                {rel.cover_image && (
                                    <img src={rel.cover_image} alt="" className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                                )}
                                <div className="p-4">
                                    <h3 className="font-display font-semibold text-ink-900 text-sm leading-tight group-hover:text-terracotta-500 transition-colors">
                                        {rel.title}
                                    </h3>
                                    {rel.reading_time && (
                                        <p className="text-xs text-ink-400 mt-1">{rel.reading_time} min</p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
