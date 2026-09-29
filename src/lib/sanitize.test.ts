import { describe, expect, it } from 'vitest';
import { sanitizePlainText, sanitizeTiptapDocument } from '@/lib/sanitize';

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
