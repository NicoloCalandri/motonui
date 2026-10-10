'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Loader2, X } from 'lucide-react';
import { buildSlides, INSTAGRAM_FORMATS } from '@/lib/media/instagram-slides';
import SlidePreview from '@/components/instagram/SlidePreview';
import type { InstagramExportStatusResponse, MediaWithUrls } from '@/lib/types';

const FILTERS = [
    ['none', 'Nessuno'], ['warm', 'Caldo'], ['cool', 'Freddo'], ['vintage', 'Vintage'], ['bw', 'Bianco e nero'], ['vivid', 'Vivido'],
] as const;

const GeneratorSchema = z.object({
    format: z.enum(['carousel', 'story']),
    filter: z.enum(['none', 'warm', 'cool', 'vintage', 'bw', 'vivid']),
    overlayText: z.string().trim().max(120, 'Massimo 120 caratteri'),
    generateCaption: z.boolean(),
});

type GeneratorValues = z.infer<typeof GeneratorSchema>;

interface InstagramGeneratorProps {
    tripId: string;
    /** Selected media, in selection order */
    media: MediaWithUrls[];
    onClose: () => void;
}

async function fetchStatus(url: string): Promise<InstagramExportStatusResponse> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Ops! Non riusciamo a leggere lo stato dell’export 🏝️');
    return res.json();
}

/**
 * Instagram generator (T-2.7, FR-34–35): format, filter, text and caption,
 * slide preview from buildSlides(), then an async export polled with SWR
 * until the ZIP is ready (signed link, valid 24 h).
 */
export default function InstagramGenerator({ tripId, media, onClose }: InstagramGeneratorProps) {
    const form = useForm<GeneratorValues>({
        resolver: zodResolver(GeneratorSchema),
        defaultValues: { format: 'carousel', filter: 'none', overlayText: '', generateCaption: false },
    });
    const [exportId, setExportId] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const format = form.watch('format');
    const plan = buildSlides(media, format);

    const { data: job, error: pollError } = useSWR(
        exportId ? `/api/trips/${tripId}/instagram/exports/${exportId}` : null,
        fetchStatus,
        { refreshInterval: (latest) => (latest && latest.status !== 'processing' && latest.status !== 'pending' ? 0 : 2000) },
    );

    const onSubmit = async (values: GeneratorValues) => {
        setSubmitError(null);
        const res = await fetch(`/api/trips/${tripId}/instagram/exports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mediaIds: plan.slides.map((slide) => slide.mediaId),
                format: values.format,
                filter: values.filter,
                textOverlay: values.overlayText ? { text: values.overlayText } : undefined,
                generateCaption: values.generateCaption,
            }),
        });
        const body: { id?: string; error?: string } = await res.json();
        if (!res.ok || !body.id) {
            setSubmitError(body.error ?? 'Ops! Qualcosa è andato storto 🏝️');
            return;
        }
        setExportId(body.id);
    };

    const running = Boolean(exportId) && (!job || job.status === 'processing' || job.status === 'pending');

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink-900/60" role="dialog" aria-modal="true" aria-labelledby="ig-title">
            <div className="w-full md:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 id="ig-title" className="text-lg font-bold text-ink-900">📸 Export per Instagram</h2>
                    <button type="button" onClick={onClose} aria-label="Chiudi" className="p-2 rounded-full hover:bg-sand-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <SlidePreview plan={plan} />

                {!exportId && (
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <fieldset className="flex gap-2">
                            <legend className="sr-only">Formato</legend>
                            {(Object.keys(INSTAGRAM_FORMATS) as Array<keyof typeof INSTAGRAM_FORMATS>).map((key) => (
                                <label key={key} className={`flex-1 text-center px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer ${format === key ? 'bg-ink-900 text-white' : 'bg-sand-100 text-ink-600'}`}>
                                    <input type="radio" value={key} {...form.register('format')} className="sr-only" />
                                    {INSTAGRAM_FORMATS[key].label} · {INSTAGRAM_FORMATS[key].ratio}
                                </label>
                            ))}
                        </fieldset>

                        <label className="block text-sm text-ink-600">
                            Filtro
                            <select {...form.register('filter')} className="mt-1 w-full px-3 py-2 rounded-xl bg-sand-50 border border-sand-200">
                                {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>

                        <label className="block text-sm text-ink-600">
                            Testo sulle foto (facoltativo)
                            <input {...form.register('overlayText')} maxLength={120} className="mt-1 w-full px-3 py-2 rounded-xl bg-sand-50 border border-sand-200" />
                        </label>

                        <label className="flex items-center gap-2 text-sm text-ink-600">
                            <input type="checkbox" {...form.register('generateCaption')} />
                            Scrivi anche la caption con l&apos;AI
                        </label>

                        {(submitError || form.formState.errors.overlayText) && (
                            <p role="alert" className="text-sm text-red-600">{submitError ?? form.formState.errors.overlayText?.message}</p>
                        )}

                        <button
                            type="submit"
                            disabled={plan.slides.length === 0 || form.formState.isSubmitting}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-terracotta-400 text-white font-bold disabled:opacity-50"
                        >
                            {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                            Crea ZIP ({plan.slides.length} {plan.slides.length === 1 ? 'foto' : 'foto'})
                        </button>
                    </form>
                )}

                {exportId && (
                    <div className="space-y-4" aria-live="polite">
                        {running && (
                            <p className="flex items-center gap-2 text-sm text-ink-500">
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Stiamo preparando le foto...
                            </p>
                        )}
                        {(job?.status === 'failed' || pollError) && (
                            <p role="alert" className="text-sm text-red-600">{job?.error ?? pollError?.message}</p>
                        )}
                        {job?.status === 'ready' && job.download_url && (
                            <>
                                <a href={job.download_url} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-ink-900 text-white font-bold">
                                    <Download className="w-4 h-4" aria-hidden="true" /> Scarica lo ZIP
                                </a>
                                <p className="text-xs text-ink-400">Il link vale fino a 24 ore, poi lo ZIP viene eliminato.</p>
                                {job.caption && (
                                    <div className="p-3 rounded-2xl bg-sand-50 text-sm text-ink-700 whitespace-pre-line">
                                        {job.caption}
                                        {job.hashtags.length > 0 && <p className="mt-2 text-terracotta-500">{job.hashtags.join(' ')}</p>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
