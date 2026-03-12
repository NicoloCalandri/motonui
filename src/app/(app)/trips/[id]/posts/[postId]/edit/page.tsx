'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Globe, FileText, Loader2, Eye } from 'lucide-react';
import PostEditor from '@/components/blog/PostEditor';
import type { Post, TiptapDoc } from '@/lib/types';

const MetaSchema = z.object({
    title: z.string().min(1, 'Titolo richiesto'),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Solo lettere minuscole, numeri e trattini'),
    status: z.enum(['draft', 'published']),
    seo_title: z.string().max(60).optional(),
    seo_description: z.string().max(160).optional(),
});

type MetaValues = z.infer<typeof MetaSchema>;

/**
 * Full-screen blog post editor page with Tiptap editor, sidebar for meta.
 */
export default function PostEditPage() {
    const { id: tripId, postId } = useParams<{ id: string; postId: string }>();
    const router = useRouter();
    const [post, setPost] = useState<Post | null>(null);
    const [content, setContent] = useState<TiptapDoc | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const isNew = postId === 'new';

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MetaValues>({
        resolver: zodResolver(MetaSchema),
        defaultValues: { status: 'draft' },
    });

    const title = watch('title');

    // Auto-generate slug from title
    useEffect(() => {
        if (isNew && title) {
            const slug = title
                .toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
            setValue('slug', slug);
        }
    }, [title, isNew, setValue]);

    // Load existing post
    useEffect(() => {
        if (!isNew) {
            fetch(`/api/trips/${tripId}/posts/${postId}`)
                .then((r) => r.json())
                .then((data: Post) => {
                    setPost(data);
                    setContent(data.content_json);
                    setValue('title', data.title);
                    setValue('slug', data.slug);
                    setValue('status', data.status);
                    if (data.seo_title) setValue('seo_title', data.seo_title);
                    if (data.seo_description) setValue('seo_description', data.seo_description);
                })
                .catch(() => { });
        }
    }, [tripId, postId, isNew, setValue]);

    const onSave = async (meta: MetaValues) => {
        setSaving(true);
        setSaveStatus('saving');

        try {
            const body = {
                ...meta,
                content_json: content,
                published_at: meta.status === 'published' ? new Date().toISOString() : null,
            };

            let res: Response;
            if (isNew) {
                res = await fetch(`/api/trips/${tripId}/posts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
            } else {
                res = await fetch(`/api/trips/${tripId}/posts/${postId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
            }

            if (!res.ok) throw new Error('Save failed');

            const saved: Post = await res.json();
            setSaveStatus('saved');

            if (isNew) {
                router.replace(`/trips/${tripId}/posts/${saved.id}/edit`);
            }

            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-sand-50 flex flex-col">
            {/* Top bar */}
            <div className="sticky top-0 z-30 bg-sand-50/95 backdrop-blur-sm border-b border-sand-200 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 hover:bg-sand-100 rounded-xl">
                    <ArrowLeft className="w-5 h-5 text-ink-500" />
                </button>

                <div className="flex-1 min-w-0">
                    <input
                        {...register('title')}
                        placeholder="Titolo del post..."
                        className="w-full font-display text-lg font-semibold text-ink-900 bg-transparent placeholder-ink-300 focus:outline-none"
                    />
                    {errors.title && <p className="text-xs text-terracotta-500">{errors.title.message}</p>}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Save status indicator */}
                    {saveStatus === 'saving' && <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />}
                    {saveStatus === 'saved' && <span className="text-xs text-sage-500">✓ Salvato</span>}
                    {saveStatus === 'error' && <span className="text-xs text-terracotta-500">Errore</span>}

                    {/* Preview link */}
                    {post?.status === 'published' && (
                        <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-sand-100 rounded-xl"
                        >
                            <Eye className="w-4 h-4" />
                        </a>
                    )}

                    {/* Publish toggle */}
                    <select
                        {...register('status')}
                        className="px-3 py-1.5 rounded-xl border border-sand-300 bg-white text-ink-700 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                    >
                        <option value="draft">Bozza</option>
                        <option value="published">Pubblicato</option>
                    </select>

                    <button
                        onClick={handleSubmit(onSave)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-ink-900 hover:bg-ink-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Salva
                    </button>
                </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Main editor */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full">
                    <PostEditor
                        initialContent={content}
                        onChange={setContent}
                        tripId={tripId}
                        postId={postId}
                    />
                </main>

                {/* Sidebar */}
                <aside className="hidden xl:block w-72 border-l border-sand-200 p-5 overflow-y-auto space-y-5">
                    <div>
                        <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" /> SEO
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-ink-500 mb-1">Slug URL</label>
                                <input
                                    {...register('slug')}
                                    className="w-full px-3 py-2 rounded-xl border border-sand-300 bg-white text-ink-700 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-ink-500 mb-1">
                                    Titolo SEO <span className="text-ink-300">(max 60)</span>
                                </label>
                                <input
                                    {...register('seo_title')}
                                    className="w-full px-3 py-2 rounded-xl border border-sand-300 bg-white text-ink-700 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-ink-500 mb-1">
                                    Descrizione SEO <span className="text-ink-300">(max 160)</span>
                                </label>
                                <textarea
                                    {...register('seo_description')}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-xl border border-sand-300 bg-white text-ink-700 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Post info
                        </h3>
                        <div className="text-xs text-ink-400 space-y-1">
                            {post?.published_at && (
                                <p>Pubblicato: {new Date(post.published_at).toLocaleDateString('it-IT')}</p>
                            )}
                            {post?.reading_time && <p>Lettura: {post.reading_time} minuti</p>}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
