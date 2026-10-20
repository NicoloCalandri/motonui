import { describe, expect, it } from 'vitest';
import { buildSlides, INSTAGRAM_FORMATS, type SlideSource } from './instagram-slides';

function photo(id: string, overrides: Partial<SlideSource> = {}): SlideSource {
    return { id, mime_type: 'image/webp', storage_path: `trips/t/original/${id}.webp`, signed_thumb_url: `https://s/${id}`, ...overrides };
}

describe('buildSlides', () => {
    it('turns 10 photos into a 10-slide 4:5 carousel in the chosen order', () => {
        const media = Array.from({ length: 10 }, (_, i) => photo(`m${10 - i}`));

        const plan = buildSlides(media, 'carousel');

        expect(plan.slides).toHaveLength(10);
        expect(plan.skipped).toEqual([]);
        expect(plan.slides.map((s) => s.mediaId)).toEqual(media.map((m) => m.id));
        expect(plan.slides[0]).toMatchObject({ index: 1, fileName: 'carousel_01.jpg', width: 1080, height: 1350, previewUrl: 'https://s/m10' });
        expect(plan.slides[9].fileName).toBe('carousel_10.jpg');
    });

    it('caps each format at its maximum and reports the rest', () => {
        const media = Array.from({ length: 12 }, (_, i) => photo(`m${i}`));

        expect(buildSlides(media, 'carousel').skipped).toEqual([
            { mediaId: 'm10', reason: 'over_limit' },
            { mediaId: 'm11', reason: 'over_limit' },
        ]);

        const story = buildSlides(media.slice(0, 2), 'story');
        expect(story.slides).toHaveLength(INSTAGRAM_FORMATS.story.maxSlides);
        expect(story.slides[0]).toMatchObject({ width: 1080, height: 1920, fileName: 'story_01.jpg' });
    });

    it('skips videos, external links and duplicates without breaking the numbering', () => {
        const plan = buildSlides([
            photo('a'),
            photo('v', { mime_type: 'video/mp4' }),
            photo('x', { storage_path: null }),
            photo('a'),
            photo('b'),
        ], 'carousel');

        expect(plan.slides.map((s) => [s.index, s.mediaId])).toEqual([[1, 'a'], [2, 'b']]);
        expect(plan.skipped).toEqual([
            { mediaId: 'v', reason: 'video' },
            { mediaId: 'x', reason: 'not_uploaded' },
            { mediaId: 'a', reason: 'duplicate' },
        ]);
    });

    it('returns an empty plan for an empty selection', () => {
        expect(buildSlides([], 'carousel')).toEqual({ format: 'carousel', slides: [], skipped: [] });
    });
});
