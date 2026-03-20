import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Post } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, MapPin, ArrowLeft, Share2 } from 'lucide-react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';

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
            images: post.cover_image ? [post.cover_image] : ['https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'],
        },
    };
}

/**
 * Blog post view — server component.
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

    // Fetch related posts
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
        <div className="max-w-7xl mx-auto pb-20 animate-fade-in">
            {/* Back button */}
            <div className="mb-8">
                <Link href="/blog" className="inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-900 transition-colors text-sm font-bold uppercase tracking-widest">
                    <ArrowLeft className="w-4 h-4" />
                    Tutti i post
                </Link>
            </div>

            <div className="h-[400px] w-full relative overflow-hidden rounded-[48px] mb-12 shadow-panel">
                <img
                    src={typedPost.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'}
                    alt={typedPost.title}
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto">
                {/* Meta */}
                {typedPost.trips?.destination && (
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-6">
                        <MapPin className="w-4 h-4" />
                        {typedPost.trips.destination}
                    </div>
                )}

                <h1 className="text-4xl md:text-6xl font-bold text-neutral-900 mb-8 leading-[1.1] tracking-tight">
                    {typedPost.title}
                </h1>

                <div className="flex items-center gap-6 text-xs font-bold text-neutral-400 uppercase tracking-widest mb-12 pb-12 border-b border-neutral-100">
                    {typedPost.published_at && (
                        <span>{format(new Date(typedPost.published_at), 'd MMMM yyyy', { locale: it })}</span>
                    )}
                    {typedPost.reading_time && (
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {typedPost.reading_time} min
                        </span>
                    )}
                </div>

                {/* Post body — Tiptap HTML */}
                {htmlContent ? (
                    <div
                        className="prose prose-neutral prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-neutral-600 prose-p:leading-relaxed prose-img:rounded-[32px] prose-img:shadow-panel"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                ) : (
                    <p className="text-neutral-400 italic font-medium">Contenuto non disponibile.</p>
                )}

                {/* Related posts */}
                {related && related.length > 0 && (
                    <div className="mt-32 pt-16 border-t border-neutral-100">
                        <h2 className="text-2xl font-bold text-neutral-900 mb-10">Altri post da questo viaggio</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {(related as Post[]).map((rel) => (
                                <Link key={rel.id} href={`/blog/${rel.slug}`} className="group">
                                    <div className="card h-full flex flex-col overflow-hidden border-none shadow-soft hover:shadow-panel transition-all duration-500 rounded-[32px]">
                                        <div className="h-40 overflow-hidden bg-neutral-100">
                                            <img src={rel.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        </div>
                                        <div className="p-6">
                                            <h3 className="text-lg font-bold text-neutral-900 group-hover:text-ink-900 transition-colors leading-tight">
                                                {rel.title}
                                            </h3>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
