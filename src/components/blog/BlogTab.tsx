'use client';

import { useEffect, useState } from 'react';
import type { Post } from '@/lib/types';
import Link from 'next/link';
import { PlusCircle, FileText, Globe, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BlogTabProps { tripId: string }

/**
 * Blog tab: list of posts for this trip + link to create new post.
 */
export default function BlogTab({ tripId }: BlogTabProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/trips/${tripId}/posts`)
            .then((r) => r.json())
            .then((data: Post[]) => { setPosts(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [tripId]);

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-900">Blog del viaggio</h2>
                <Link
                    href={`/trips/${tripId}/posts/new/edit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta-400 text-white rounded-xl text-sm font-medium hover:bg-terracotta-500 transition-colors"
                >
                    <PlusCircle className="w-4 h-4" /> Nuovo post
                </Link>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-sand-100" />)}
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-12 text-ink-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-sand-300" />
                    <p className="font-display text-lg font-semibold text-ink-700 mb-1">Nessun post ancora</p>
                    <p className="text-sm mb-4">Racconta il vostro viaggio con un blog post</p>
                    <Link
                        href={`/trips/${tripId}/posts/new/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-ink-900 text-white rounded-xl text-sm font-medium"
                    >
                        <Edit3 className="w-4 h-4" /> Scrivi il primo post
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map((post) => (
                        <div key={post.id} className="card p-4 flex items-center gap-4">
                            {post.cover_image && (
                                <img
                                    src={post.cover_image}
                                    alt=""
                                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-display font-semibold text-ink-900 truncate">{post.title}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.status === 'published'
                                            ? 'bg-sage-100 text-sage-600'
                                            : 'bg-sand-200 text-ink-400'
                                        }`}>
                                        {post.status === 'published' ? '✓ Pubblicato' : 'Bozza'}
                                    </span>
                                    {post.reading_time && (
                                        <span className="text-xs text-ink-400">{post.reading_time} min di lettura</span>
                                    )}
                                </div>
                                {post.published_at && (
                                    <p className="text-xs text-ink-400 mt-0.5">
                                        {format(new Date(post.published_at), 'd MMM yyyy', { locale: it })}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                {post.status === 'published' && (
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        target="_blank"
                                        className="p-2 text-ink-400 hover:text-sage-500 hover:bg-sage-50 rounded-lg transition-colors"
                                    >
                                        <Globe className="w-4 h-4" />
                                    </Link>
                                )}
                                <Link
                                    href={`/trips/${tripId}/posts/${post.id}/edit`}
                                    className="p-2 text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 rounded-lg transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
