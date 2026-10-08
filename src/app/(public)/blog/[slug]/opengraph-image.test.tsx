// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => ({
    data: {
        id: 'p1', slug: 'rapa-nui', title: 'Rapa Nui', seo_title: null, og_description: 'Moai al tramonto',
        seo_description: null, published_at: '2026-09-01T10:00:00Z', reading_time: 6,
    } as Record<string, unknown> | null,
}));

vi.mock('@/lib/supabase/public', async () => {
    const { queryChain } = await import('@/test/supabase-mock');
    return { createPublicClient: () => ({ from: () => queryChain({ data: post.data, error: null }) }) };
});

import Image, { alt, contentType, size } from './opengraph-image';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

async function png(slug: string) {
    const res = await Image({ params: Promise.resolve({ slug }) });
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { res, bytes };
}

describe('post Open Graph image (T-5.4)', () => {
    it('declares a 1200×630 PNG with an Italian alt text', () => {
        expect(size).toEqual({ width: 1200, height: 630 });
        expect(contentType).toBe('image/png');
        expect(alt).toMatch(/blog di motonui/);
    });

    it('renders a PNG for a published post', async () => {
        const { res, bytes } = await png('rapa-nui');
        expect(res.headers.get('content-type')).toBe('image/png');
        expect(Array.from(bytes.slice(0, 4))).toEqual(PNG_SIGNATURE);
    }, 20_000);

    it('still renders a generic card for an unknown slug', async () => {
        post.data = null;
        const { bytes } = await png('nope');
        expect(Array.from(bytes.slice(0, 4))).toEqual(PNG_SIGNATURE);
    }, 20_000);
});
