import { describe, expect, it } from 'vitest';
import { safeTiptapDocument, sanitizePlainText, sanitizeTiptapDocument } from '@/lib/sanitize';

describe('sanitizePlainText', () => {
    it('stores text as typed, without HTML-escaping (escaping happens on output)', () => {
        expect(sanitizePlainText('Pizza & birra <3')).toBe('Pizza & birra <3');
    });

    it('trims, drops control characters and caps the length', () => {
        expect(sanitizePlainText('  ciao\u0000\u0007 mondo\n ')).toBe('ciao mondo');
        expect(sanitizePlainText('abcdef', 3)).toBe('abc');
    });

    it('keeps newlines and tabs inside the text', () => {
        expect(sanitizePlainText('riga 1\n\triga 2')).toBe('riga 1\n\triga 2');
    });
});

describe('sanitizeTiptapDocument', () => {
    it('drops __proto__ and unknown attributes instead of copying them', () => {
        // JSON.parse keeps "__proto__" as an own key: this is what a request body looks like.
        const hostile = JSON.parse(JSON.stringify({
            type: 'doc',
            content: [
                { type: 'paragraph', attrs: { PROTO: { onclick: 'alert(1)' }, onmouseover: 'alert(2)' }, content: [{ type: 'text', text: 'ciao' }] },
                { type: 'image', attrs: { src: 'https://a.example/x.png', PROTO: { onerror: 'alert(3)' }, onerror: 'alert(4)' } },
                { type: 'heading', attrs: { level: 2, PROTO: { onclick: 'alert(5)' } }, content: [{ type: 'text', text: 't' }] },
            ],
        }).replaceAll('"PROTO"', '"__proto__"'));
        expect(Object.getOwnPropertyNames(hostile.content[0].attrs)).toContain('__proto__');

        const result = sanitizeTiptapDocument(hostile);

        const ownProto: unknown[] = [];
        const walk = (node: unknown) => {
            if (!node || typeof node !== 'object') return;
            for (const key of Object.getOwnPropertyNames(node)) {
                if (key === '__proto__') ownProto.push(node);
                walk((node as Record<string, unknown>)[key]);
            }
        };
        walk(result);
        expect(ownProto).toEqual([]);
        expect(JSON.stringify(result)).not.toContain('alert');
        expect(result.content?.[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'ciao' }] });
        expect(result.content?.[1]).toEqual({ type: 'image', attrs: { src: 'https://a.example/x.png' } });
        expect(result.content?.[2]?.attrs).toEqual({ level: 2 });
    });

    it('removes unsafe marks and normalizes links', () => {
        const result = sanitizeTiptapDocument({
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [{
                    type: 'text',
                    text: 'hello',
                    marks: [
                        { type: 'bold' },
                        { type: 'script' },
                        { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                        { type: 'link', attrs: { href: 'https://example.com' } },
                    ],
                }],
            }],
        });

        const marks = result.content?.[0]?.content?.[0]?.marks;
        expect(marks).toEqual([
            { type: 'bold' },
            {
                type: 'link',
                attrs: {
                    href: 'https://example.com/',
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                },
            },
        ]);
    });
});

describe('safeTiptapDocument', () => {
    it('returns the sanitized document', () => {
        const doc = safeTiptapDocument({ type: 'doc', content: [{ type: 'iframe' }, { type: 'paragraph', content: [{ type: 'text', text: 'ciao' }] }] });
        expect(doc).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ciao' }] }] });
    });

    it.each([null, undefined, 'ciao', 42, [], { type: 'paragraph' }])('returns null instead of throwing for %j', (value) => {
        expect(safeTiptapDocument(value)).toBeNull();
    });
});
