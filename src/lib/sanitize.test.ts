import { describe, expect, it } from 'vitest';
import { sanitizePlainText, sanitizeTiptapDocument } from '@/lib/sanitize';

describe('sanitizePlainText', () => {
    it('escapes HTML metacharacters', () => {
        expect(sanitizePlainText('<img src=x onerror=1>')).toBe('&lt;img src=x onerror=1&gt;');
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
