import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, Clock, Loader2, MapPin } from 'lucide-react';
import ShareButton from '../../app/(public)/blog/_components/ShareButton';
import { getPublishedPost, listRelatedPosts } from '../../lib/blog/public-posts';
import { renderPostHtml } from '../../lib/blog/render';
import { supabase } from '../../lib/supabase-client';

/**
 * Public blog post. Ported from src/app/(public)/blog/[slug]/page.tsx, a
 * server component. Here the post is read and rendered in the browser:
 * renderPostHtml (copied) sanitizes the stored document again before it
 * becomes the HTML injected below, exactly as on the server.
 *
 * What the server page also does and this one cannot: metadata and Open
 * Graph tags in the first response (crawlers that do not run scripts see the
 * shell only). The title is set once the post has loaded.
 */
export function BlogPostPage() {
    const { slug = '' } = useParams();
    const { data, error, isLoading } = useSWR(['blog:post', slug], async () => {
        const post = await getPublishedPost(supabase, slug);
        return post ? { post, related: await listRelatedPosts(supabase, post) } : null;
    });
    const post = data?.post ?? null;
    const htmlContent = useMemo(() => (post ? renderPostHtml(post.content_json) : ''), [post]);

    useEffect(() => {
        if (post) document.title = `${post.seo_title ?? post.title} · motonui`;
    }, [post]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-ink-300" aria-label="Caricamento" />
            </div>
        );
    }

    if (error) {
        return (
            <p role="alert" className="max-w-2xl mx-auto card p-16 text-center text-ink-500">
                Ops! Non riusciamo a caricare questo post. Riprova tra poco 🏝️
            </p>
        );
    }

    if (!post) {
        return (
            <div className="max-w-2xl mx-auto card p-16 text-center space-y-4">
                <h1 className="font-display text-2xl font-bold text-ink-900">Ops! Post introvabile 🏝️</h1>
                <p className="text-ink-500">Forse è stato spostato, o non è ancora stato pubblicato.</p>
                <Link to="/blog" className="inline-block font-medium text-terracotta-500 hover:underline">Tutti i post</Link>
            </div>
        );
    }

    const related = data?.related ?? [];

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <Link to="/blog" className="flex items-center gap-2 text-ink-500 hover:text-ink-900 text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    Tutti i post
                </Link>
                <ShareButton title={post.title} />
            </div>

            {post.cover_image && (
                <div className="relative h-64 md:h-96 overflow-hidden rounded-3xl mb-10">
                    <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 hero-gradient" />
                </div>
            )}

            <article className="max-w-2xl mx-auto">
                {post.trips?.destination && (
                    <div className="flex items-center gap-1.5 text-terracotta-400 text-sm mb-3">
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                        <Link to="/blog" className="hover:underline">{post.trips.destination}</Link>
                    </div>
                )}

                <h1 className="font-display text-3xl md:text-5xl font-bold text-ink-900 mb-4 leading-tight">
                    {post.title}
                </h1>

                <div className="flex items-center gap-4 text-ink-400 text-sm mb-10 pb-8 border-b border-sand-200">
                    {post.published_at && (
                        <span>{format(new Date(post.published_at), 'd MMMM yyyy', { locale: it })}</span>
                    )}
                    {post.reading_time && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            {post.reading_time} minuti di lettura
                        </span>
                    )}
                </div>

                {htmlContent ? (
                    <div
                        className="prose prose-lg prose-headings:font-display prose-headings:text-ink-900 prose-p:text-ink-700 prose-p:leading-relaxed prose-a:text-terracotta-500 prose-blockquote:border-terracotta-300 prose-blockquote:italic prose-img:rounded-2xl max-w-none"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                ) : (
                    <p className="text-ink-400 italic">Contenuto non disponibile.</p>
                )}
            </article>

            {related.length > 0 && (
                <div className="border-t border-sand-200 mt-16 pt-12">
                    <h2 className="font-display text-2xl font-bold text-ink-900 mb-6">
                        Altri post dallo stesso viaggio
                    </h2>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {related.map((rel) => (
                            <Link key={rel.id} to={`/blog/${rel.slug}`} className="card group overflow-hidden hover:shadow-card-hover transition-shadow">
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
