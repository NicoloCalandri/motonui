/**
 * A post that uses every node and mark the editor and the sanitizer allow.
 * render.test.ts pins its HTML, so a Tiptap upgrade cannot change how
 * published posts look without a test failing.
 */
export const FULL_DOC = {
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Rapa Nui' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Giorno 1' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Mattina' }] },
        {
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Moai ' },
                { type: 'text', text: 'grandi', marks: [{ type: 'bold' }] },
                { type: 'text', text: ', ' },
                { type: 'text', text: 'antichi', marks: [{ type: 'italic' }] },
                { type: 'text', text: ', ' },
                { type: 'text', text: 'lontani', marks: [{ type: 'strike' }] },
                { type: 'text', text: ' e ' },
                { type: 'text', text: 'ahu', marks: [{ type: 'code' }] },
                { type: 'hardBreak' },
                { type: 'text', text: 'Il sito', marks: [{ type: 'link', attrs: { href: 'https://example.com/moai' } }] },
                { type: 'text', text: ' in ' },
                { type: 'text', text: 'grassetto corsivo', marks: [{ type: 'bold' }, { type: 'italic' }] },
            ],
        },
        {
            type: 'bulletList',
            content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anakena' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Orongo' }] }] },
            ],
        },
        {
            type: 'orderedList',
            content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Volo' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alba' }] }] },
            ],
        },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A 2.688 km da tutto.' }] }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'const isola = "Motu Nui";\n<b>non html</b>' }] },
        { type: 'horizontalRule' },
        { type: 'image', attrs: { src: 'https://example.com/moai.jpg', alt: 'Moai al tramonto', title: 'Tongariki' } },
        { type: 'paragraph' },
    ],
};
