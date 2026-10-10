// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderPostHtml, UNAVAILABLE_CONTENT_HTML } from '@/lib/blog/render';
import { FULL_DOC } from './render-fixture';

/** A document as it could be written straight into posts.content_json via REST. */
function docWith(...content: unknown[]) {
    return { type: 'doc', content };
}

describe('renderPostHtml', () => {
    it('renders every supported node and mark (pinned)', () => {
        // If a Tiptap upgrade changes this string, published posts change too: decide on purpose.
        // Tiptap 2 produced the same markup, except that it wrote the quotes in text as &quot;.
        expect(renderPostHtml(FULL_DOC)).toBe(
            "<h1>Rapa Nui</h1><h2>Giorno 1</h2><h3>Mattina</h3><p>Moai <strong>grandi</strong>, <em>antichi</em>, <s>lontani</s> e <code>ahu</code><br><a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"https://example.com/moai\">Il sito</a> in <strong><em>grassetto corsivo</em></strong></p><ul><li><p>Anakena</p></li><li><p>Orongo</p></li></ul><ol><li><p>Volo</p></li><li><p>Alba</p></li></ol><blockquote><p>A 2.688 km da tutto.</p></blockquote><pre><code>const isola = \"Motu Nui\";\n&lt;b&gt;non html&lt;/b&gt;</code></pre><hr><img src=\"https://example.com/moai.jpg\" alt=\"Moai al tramonto\" title=\"Tongariki\"><p></p>",
        );
    });

    it('registers each extension once', () => {
        // Tiptap 3's StarterKit bundles Link: adding it again makes Tiptap warn about duplicates.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderPostHtml(FULL_DOC);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('renders a normal post', () => {
        const html = renderPostHtml(docWith(
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rapa Nui' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Moai & tramonti', marks: [{ type: 'bold' }] }] },
        ));
        expect(html).toContain('<h2>Rapa Nui</h2>');
        expect(html).toContain('<strong>Moai &amp; tramonti</strong>');
    });

    it('drops javascript: links written via REST', () => {
        const html = renderPostHtml(docWith({
            type: 'paragraph',
            content: [{ type: 'text', text: 'clicca', marks: [{ type: 'link', attrs: { href: 'javascript:alert(document.cookie)' } }] }],
        }));
        expect(html).not.toMatch(/javascript:/i);
        expect(html).not.toContain('<a');
        expect(html).toContain('clicca');
    });

    it('keeps safe links with rel/target enforced', () => {
        const html = renderPostHtml(docWith({
            type: 'paragraph',
            content: [{ type: 'text', text: 'sito', marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_self', rel: '' } }] }],
        }));
        expect(html).toContain('href="https://example.com/"');
        expect(html).toContain('rel="noopener noreferrer nofollow"');
    });

    it('drops unsafe images and unknown nodes', () => {
        const html = renderPostHtml(docWith(
            { type: 'image', attrs: { src: 'javascript:alert(1)' } },
            { type: 'image', attrs: { src: 'data:text/html,<script>alert(1)</script>' } },
            { type: 'iframe', attrs: { src: 'https://evil.example' } },
            { type: 'paragraph', content: [{ type: 'text', text: 'ok' }] },
        ));
        expect(html).not.toMatch(/javascript:|data:text|iframe|<script/i);
        expect(html).toContain('<p>ok</p>');
    });

    it('escapes markup in text and image attributes', () => {
        const html = renderPostHtml(docWith(
            { type: 'paragraph', content: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] },
            { type: 'image', attrs: { src: 'https://example.com/a.jpg', alt: '" onerror="alert(1)' } },
        ));
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toMatch(/alt="" onerror=/);
    });

    it('falls back to a placeholder for malformed documents', () => {
        expect(renderPostHtml({ type: 'paragraph' })).toBe(UNAVAILABLE_CONTENT_HTML);
        expect(renderPostHtml(null)).toBe('');
    });
});
