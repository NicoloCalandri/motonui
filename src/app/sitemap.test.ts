// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const posts = vi.hoisted(() => ({
    rows: [
        { slug: 'rapa-nui', updated_at: '2026-09-02T10:00:00Z', published_at: '2026-09-01T10:00:00Z' },
        { slug: 'motu-nui', updated_at: '2026-08-02T10:00:00Z', published_at: '2026-08-01T10:00:00Z' },
    ],
}));

vi.mock('@/lib/supabase/public', async () => {
    const { queryChain } = await import('@/test/supabase-mock');
    return { createPublicClient: () => ({ from: () => queryChain({ data: posts.rows, error: null }) }) };
});

import sitemap from './sitemap';
import robots from './robots';

describe('sitemap.xml and robots.txt (T-5.2)', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('lists the blog index and every published post on the app URL', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://motonui.app');
        const entries = await sitemap();
        const urls = entries.map((e) => e.url);

        expect(urls).toEqual([
            'https://motonui.app/',
            'https://motonui.app/blog',
            'https://motonui.app/blog/rapa-nui',
            'https://motonui.app/blog/motu-nui',
        ]);
        expect(entries[1].lastModified).toBe('2026-09-01T10:00:00Z');
        expect(entries[2].lastModified).toBe('2026-09-02T10:00:00Z');
    });

    it('keeps private areas out of the index and points to the sitemap', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://motonui.app');
        const result = robots();
        const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

        expect(rules.allow).toContain('/blog');
        expect(rules.disallow).toEqual(expect.arrayContaining(['/api/', '/dashboard', '/trips', '/admin', '/invite']));
        expect(result.sitemap).toBe('https://motonui.app/sitemap.xml');
    });
});
