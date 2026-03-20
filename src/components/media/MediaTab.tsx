'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Media } from '@/lib/types';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image, Loader2, Trash2 } from 'lucide-react';

interface MediaTabProps { tripId: string }

/**
 * Media tab: masonry photo grid, drag-and-drop upload, lightbox.
 */
export default function MediaTab({ tripId }: MediaTabProps) {
    const [media, setMedia] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [lightbox, setLightbox] = useState<Media | null>(null);

    const fetchMedia = () => {
        fetch(`/api/trips/${tripId}/media`)
            .then((r) => r.json())
            .then((data: Media[]) => { setMedia(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchMedia(); }, [tripId]);

    const onDrop = useCallback(async (files: File[]) => {
        setUploading(true);
        for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            await fetch(`/api/trips/${tripId}/media`, { method: 'POST', body: form });
        }
        fetchMedia();
        setUploading(false);
    }, [tripId]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [], 'video/mp4': [] },
        maxSize: 50 * 1024 * 1024,
    });

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const deleteMedia = async (id: string) => {
        if (!confirm('Eliminare questa foto?')) return;
        setLightbox(null);
        await fetch(`/api/trips/${tripId}/media/${id}`, { method: 'DELETE' });
        fetchMedia();
    };

    return (
        <div className="p-4 md:p-6">
            {/* Upload zone */}
            <div
                {...getRootProps()}
                className={`mb-5 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-terracotta-400 bg-terracotta-50' : 'border-sand-300 hover:border-sand-400 hover:bg-sand-100'
                    }`}
            >
                <input {...getInputProps()} />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-ink-400">
                        <Loader2 className="w-8 h-8 animate-spin text-terracotta-400" />
                        <p className="text-sm">Caricamento in corso...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-ink-400">
                        <Upload className="w-8 h-8 text-sand-400" />
                        <p className="text-sm font-medium">
                            {isDragActive ? 'Rilascia qui le foto' : 'Trascina le foto o clicca per selezionare'}
                        </p>
                        <p className="text-xs">JPEG, PNG, WebP, MP4 · Max 50 MB</p>
                    </div>
                )}
            </div>

            {/* Selection actions bar */}
            {selected.size > 0 && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-ink-900 text-white rounded-2xl animate-slide-up">
                    <span className="text-sm flex-1">{selected.size} foto selezionate</span>
                    <a
                        href={`/api/trips/${tripId}/instagram?mediaIds=${[...selected].join(',')}`}
                        className="px-3 py-1.5 bg-terracotta-400 rounded-xl text-xs font-medium hover:bg-terracotta-300 transition-colors"
                    >
                        📸 Instagram
                    </a>
                    <button onClick={() => setSelected(new Set())} className="p-1">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Photo grid */}
            {loading ? (
                <div className="masonry">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className={`masonry-item rounded-xl bg-sand-200 animate-pulse ${i % 3 === 0 ? 'h-48' : 'h-32'}`} />
                    ))}
                </div>
            ) : media.length === 0 ? (
                <div className="text-center py-16 text-ink-400">
                    <Image className="w-12 h-12 mx-auto mb-3 text-sand-300" />
                    <p className="font-display text-lg font-semibold text-ink-700 mb-1">Nessuna foto ancora</p>
                    <p className="text-sm">Carica le vostre foto di viaggio</p>
                </div>
            ) : (
                <div className="masonry">
                    {media.map((item) => (
                        <div
                            key={item.id}
                            className="masonry-item relative group rounded-xl overflow-hidden cursor-pointer"
                            onClick={() => setLightbox(item)}
                        >
                            <img
                                src={item.thumbnail_url ?? item.url}
                                alt={item.caption ?? ''}
                                className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                            {/* Select checkbox */}
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                                className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 border-white transition-all ${selected.has(item.id)
                                        ? 'bg-terracotta-400 opacity-100'
                                        : 'bg-white/20 opacity-0 group-hover:opacity-100'
                                    }`}
                            >
                                {selected.has(item.id) && (
                                    <span className="text-white text-xs flex items-center justify-center h-full">✓</span>
                                )}
                            </button>
                            {/* Delete button */}
                            <button
                                aria-label="Elimina foto"
                                onClick={(e) => { e.stopPropagation(); deleteMedia(item.id); }}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-ink-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                            {/* Caption overlay */}
                            {item.caption && (
                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-ink-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white text-xs truncate">{item.caption}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 bg-ink-900/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setLightbox(null)}
                >
                    <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightbox(null)}>
                        <X className="w-6 h-6" />
                    </button>
                    <button
                        aria-label="Elimina foto"
                        className="absolute top-4 right-14 text-white p-2 hover:text-red-400 transition-colors"
                        onClick={(e) => { e.stopPropagation(); deleteMedia(lightbox.id); }}
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
                    <img
                        src={lightbox.url}
                        alt={lightbox.caption ?? ''}
                        className="max-w-full max-h-full rounded-xl object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {lightbox.caption && (
                        <p className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm px-4">
                            {lightbox.caption}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
