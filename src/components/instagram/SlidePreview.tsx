'use client';

import { SKIP_REASON_LABELS, type SlidePlan } from '@/lib/media/instagram-slides';

interface SlidePreviewProps {
    plan: SlidePlan;
}

/** Preview of the slides the export will contain, at the format's ratio. */
export default function SlidePreview({ plan }: SlidePreviewProps) {
    const aspect = plan.format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]';

    return (
        <div className="space-y-3">
            <ol className="flex gap-2 overflow-x-auto pb-2" aria-label="Anteprima delle slide">
                {plan.slides.map((slide) => (
                    <li key={slide.mediaId} className={`relative flex-shrink-0 w-24 ${aspect} rounded-xl overflow-hidden bg-sand-200`}>
                        {slide.previewUrl && (
                            // Signed thumbnail of a private photo: next/image cannot optimize it.
                            <img src={slide.previewUrl} alt={`Slide ${slide.index}`} className="w-full h-full object-cover" />
                        )}
                        <span className="absolute top-1 left-1 px-1.5 rounded bg-ink-900/70 text-white text-[10px] font-bold">
                            {slide.index}
                        </span>
                    </li>
                ))}
            </ol>
            {plan.skipped.length > 0 && (
                <p className="text-xs text-ink-400">
                    {plan.skipped.length === 1 ? '1 elemento escluso' : `${plan.skipped.length} elementi esclusi`}:{' '}
                    {[...new Set(plan.skipped.map((item) => SKIP_REASON_LABELS[item.reason]))].join('; ')}.
                </p>
            )}
        </div>
    );
}
