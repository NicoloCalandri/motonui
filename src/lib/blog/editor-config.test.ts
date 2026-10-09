import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_KIT_OPTIONS } from './editor-config';
import { FULL_DOC } from './render-fixture';

const editors: Editor[] = [];

function createEditor(starterKit: typeof StarterKit, content: unknown) {
    const editor = new Editor({
        extensions: [starterKit, Image.configure({ inline: false, allowBase64: false }), Link.configure({ openOnClick: false })],
        content: content as Record<string, unknown>,
    });
    editors.push(editor);
    return editor;
}

function names(editor: Editor): string[] {
    return editor.extensionManager.extensions.map((extension) => extension.name);
}

/** Any edit: plugins that append transactions (TrailingNode) run only after one. */
function typeAtStart(editor: Editor) {
    editor.view.dispatch(editor.state.tr.insertText('I ', 1));
}

// A post that ends with a heading: TrailingNode would add a paragraph after it.
const ENDS_WITH_HEADING = {
    type: 'doc',
    content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Moai' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Fine' }] },
    ],
};

describe('post editor extensions (Tiptap 3)', () => {
    afterEach(() => {
        editors.splice(0).forEach((editor) => editor.destroy());
        vi.restoreAllMocks();
    });

    it('registers link once and leaves out underline and the trailing node', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const editor = createEditor(StarterKit.configure(STARTER_KIT_OPTIONS), ENDS_WITH_HEADING);

        expect(names(editor).filter((name) => name === 'link')).toHaveLength(1);
        expect(names(editor)).not.toContain('underline');
        expect(names(editor)).not.toContain('trailingNode');
        expect(warn).not.toHaveBeenCalled();
    });

    it('loads and edits a post without adding nodes', () => {
        const editor = createEditor(StarterKit.configure(STARTER_KIT_OPTIONS), ENDS_WITH_HEADING);
        expect(editor.getText({ blockSeparator: ' | ' })).toBe('Moai | Fine');

        typeAtStart(editor);

        expect(editor.getJSON().content).toHaveLength(2);
        expect(editor.getText({ blockSeparator: ' | ' })).toBe('I Moai | Fine');
    });

    it('accepts every node and mark the sanitizer allows', () => {
        const editor = createEditor(StarterKit.configure(STARTER_KIT_OPTIONS), FULL_DOC);
        const types = new Set<string>();
        const marks = new Set<string>();
        editor.state.doc.descendants((node) => {
            types.add(node.type.name);
            node.marks.forEach((mark) => marks.add(mark.type.name));
        });

        expect([...types].sort()).toEqual([
            'blockquote', 'bulletList', 'codeBlock', 'hardBreak', 'heading', 'horizontalRule',
            'image', 'listItem', 'orderedList', 'paragraph', 'text',
        ]);
        expect([...marks].sort()).toEqual(['bold', 'code', 'italic', 'link', 'strike']);
    });

    it('keeps the commands the toolbar calls', () => {
        const editor = createEditor(StarterKit.configure(STARTER_KIT_OPTIONS), ENDS_WITH_HEADING);
        for (const command of ['toggleHeading', 'toggleBold', 'toggleItalic', 'toggleBlockquote', 'setLink', 'setImage', 'setHorizontalRule', 'undo', 'redo'] as const) {
            expect(typeof editor.commands[command]).toBe('function');
        }
    });

    it('needs these options: the default StarterKit adds underline and a trailing paragraph', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const editor = createEditor(StarterKit, ENDS_WITH_HEADING);

        expect(names(editor)).toContain('underline');
        expect(names(editor)).toContain('trailingNode');

        typeAtStart(editor);

        // The first edit appends an empty paragraph after the final heading.
        expect(editor.getJSON().content).toHaveLength(3);
    });
});
