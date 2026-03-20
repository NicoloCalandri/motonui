import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Post } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, MapPin } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Blog di viaggio — motonui',
    description: 'Storie di viaggio di Nicolò e Sara. Destinazioni, consigli e avventure di coppia.',
};

// Revalidate every hour for public caching
export const revalidate = 3600;

/** Shape of each row returned by the blog index query */
type PostCard = Pick<Post, 'id' | 'title' | 'slug' | 'cover_image' | 'published_at' | 'reading_time' | 'seo_description'> & { trips: { destination: string } | null };

/**
 * Public blog index — accessible without authentication.
 * Lists all published posts ordered by newest first.
 */
export default async function BlogIndexPage() {
    const supabase = await createClient();

    const { data: posts } = await supabase
        .from('posts')
        .select(`
      id, title, slug, cover_image, published_at, reading_time,
      seo_description,
      trips (destination)
    `)
        .eq('status', 'published')
        .order('published_at', { ascending: false });

    const allPosts = (posts ?? []) as unknown as PostCard[];

    return (
        <div className="min-h-screen paper-bg">
            {/* Header */}
            <header className="border-b border-sand-200 bg-sand-50/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="font-display text-2xl font-bold text-ink-900">motonui</Link>
                    <Link href="/auth/login" className="text-sm text-ink-500 hover:text-terracotta-400 transition-colors">
                        Accedi
                    </Link>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-12">
                {/* Hero */}
                <div className="text-center mb-16">
                    <h1 className="font-display text-4xl md:text-6xl font-bold text-ink-900 mb-4">
                        Il nostro diario di viaggio
                    </h1>
                    <p className="text-ink-400 text-lg max-w-xl mx-auto">
                        Storie, fotografie e riflessioni dai nostri viaggi in giro per il mondo.
                    </p>
                </div>

                {/* Posts grid */}
                {allPosts.length === 0 ? (
                    <div className="text-center py-20 text-ink-400">
                        <p className="font-display text-xl">Nessun post pubblicato ancora.</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {allPosts.map((post, i) => (
                            <Link
                                key={post.id}
                                href={`/blog/${post.slug}`}
                                className={`group card overflow-hidden hover:shadow-card-hover transition-shadow ${i === 0 ? 'md:col-span-2' : ''
                                    }`}
                            >
                                {post.cover_image ? (
                                    <div className={`overflow-hidden ${i === 0 ? 'h-72 md:h-80' : 'h-52'}`}>
                                        <img
                                            src={post.cover_image}
                                            alt={post.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                ) : (
                                    <div className={`bg-gradient-to-br from-terracotta-100 to-sage-100 ${i === 0 ? 'h-72 md:h-80' : 'h-52'}`} />
                                )}

                                <div className="p-5">
                                    {post.trips?.destination && (
                                        <div className="flex items-center gap-1 text-xs text-terracotta-400 mb-2">
                                            <MapPin className="w-3 h-3" />
                                            {post.trips.destination}
                                        </div>
                                    )}
                                    <h2 className={`font-display font-semibold text-ink-900 group-hover:text-terracotta-500 transition-colors leading-tight ${i === 0 ? 'text-2xl' : 'text-lg'
                                        }`}>
                                        {post.title}
                                    </h2>
                                    {post.seo_description && (
                                        <p className="text-ink-500 text-sm mt-2 line-clamp-2">{post.seo_description}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-3 text-xs text-ink-400">
                                        {post.published_at && (
                                            <span>{format(new Date(post.published_at), 'd MMM yyyy', { locale: it })}</span>
                                        )}
                                        {post.reading_time && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {post.reading_time} min
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            <footer className="border-t border-sand-200 mt-20 py-8 text-center text-ink-400 text-sm">
                <p>motonui — Il compagno di viaggio di coppia</p>
            </footer>
        </div>
    );
}
