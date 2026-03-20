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

/**
 * Blog index — lists all published posts ordered by newest first.
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

    const allPosts = (posts as unknown as (Post & { trips: { destination: string } | null })[]) ?? [];

    return (
        <div className="max-w-7xl mx-auto animate-fade-in pb-20">
            {/* Hero section style like Trips page */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1 mb-12">
                <div>
                    <h1 className="text-5xl font-bold tracking-tight text-neutral-900 mb-3">Il Diario di Viaggio</h1>
                    <p className="text-neutral-500 font-medium max-w-lg">
                        Storie, fotografie e riflessioni dai nostri viaggi in giro per il mondo.
                    </p>
                </div>
            </div>

            {/* Posts grid */}
            {allPosts.length === 0 ? (
                <div className="card p-20 text-center border-2 border-dashed border-neutral-100 bg-white/50 rounded-[48px]">
                    <p className="text-neutral-400 font-medium">Nessun post pubblicato ancora.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {allPosts.map((post, i) => (
                        <Link
                            key={post.id}
                            href={`/blog/${post.slug}`}
                            className="group"
                        >
                            <div className="card h-full flex flex-col overflow-hidden border-none shadow-soft hover:shadow-panel transition-all duration-500 rounded-[32px]">
                                <div className="h-56 relative overflow-hidden bg-neutral-100">
                                    <img
                                        src={post.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'}
                                        alt={post.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                </div>

                                <div className="p-8 flex-1 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        {post.trips?.destination && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {post.trips.destination}
                                            </div>
                                        )}
                                        <h3 className="text-2xl font-bold text-neutral-900 group-hover:text-ink-900 transition-colors leading-tight">
                                            {post.title}
                                        </h3>
                                        <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400">
                                            {post.published_at && (
                                                <span>{format(new Date(post.published_at), 'd MMM yyyy', { locale: it })}</span>
                                            )}
                                            {post.reading_time && (
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-4 h-4" />
                                                    {post.reading_time} min
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
