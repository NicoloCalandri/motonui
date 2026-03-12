'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {
    Bold, Italic, Quote, Link as LinkIcon, Image as ImageIcon,
    Heading1, Heading2, Minus, Undo, Redo, Sparkles,
} from 'lucide-react';
import type { TiptapDoc } from '@/lib/types';

interface PostEditorProps {
    initialContent?: TiptapDoc | null;
    onChange: (content: TiptapDoc) => void;
    tripId: string;
    postId: string;
}

/**
 * Tiptap rich text editor for blog posts.
 * Auto-saves every 30 seconds. Includes toolbar with AI commands.
 */
export default function PostEditor({ initialContent, onChange, tripId, postId }: PostEditorProps) {
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: false }),
        ],
        content: initialContent ?? undefined,
        editorProps: {
            attributes: {
                class: [
                    'prose prose-lg max-w-none min-h-[400px] px-6 py-5 focus:outline-none',
                    'prose-headings:font-display prose-headings:text-ink-900',
                    'prose-p:text-ink-700 prose-p:leading-relaxed',
                    'prose-blockquote:border-terracotta-300 prose-blockquote:text-ink-500 prose-blockquote:italic',
                    'prose-a:text-terracotta-500 prose-a:no-underline hover:prose-a:underline',
                ].join(' '),
            },
        },
        onUpdate: ({ editor: ed }) => {
            const json = ed.getJSON() as TiptapDoc;
            onChange(json);

            // Auto-save debounce: 30 seconds after last keystroke
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(() => {
                triggerAutoSave(json);
            }, 30_000);
        },
    });

    const triggerAutoSave = useCallback(async (content: TiptapDoc) => {
        try {
            await fetch(`/api/trips/${tripId}/posts/${postId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content_json: content }),
            });
            console.info('[motonui][PostEditor] Auto-saved');
        } catch {
            console.warn('[motonui][PostEditor] Auto-save failed');
        }
    }, [tripId, postId]);

    // Cleanup timer on unmount
    useEffect(() => () => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    }, []);

    if (!editor) return null;

    const ToolbarButton = ({
        onClick,
        active,
        title,
        children,
    }: {
        onClick: () => void;
        active?: boolean;
        title: string;
        children: React.ReactNode;
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded-lg transition-colors ${active
                    ? 'bg-terracotta-100 text-terracotta-600'
                    : 'text-ink-400 hover:text-ink-700 hover:bg-sand-100'
                }`}
        >
            {children}
        </button>
    );

    const setLink = () => {
        const url = window.prompt('URL del link:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
    };

    const insertImage = () => {
        const url = window.prompt('URL immagine:');
        if (url) editor.chain().focus().setImage({ src: url }).run();
    };

    return (
        <div className="border border-sand-200 rounded-2xl overflow-hidden bg-white">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-sand-200 bg-sand-50 flex-wrap">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    active={editor.isActive('heading', { level: 1 })}
                    title="Titolo H1"
                >
                    <Heading1 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    active={editor.isActive('heading', { level: 2 })}
                    title="Titolo H2"
                >
                    <Heading2 className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-4 bg-sand-200 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    active={editor.isActive('bold')}
                    title="Grassetto"
                >
                    <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    active={editor.isActive('italic')}
                    title="Corsivo"
                >
                    <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    active={editor.isActive('blockquote')}
                    title="Citazione"
                >
                    <Quote className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-4 bg-sand-200 mx-1" />

                <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
                    <LinkIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={insertImage} title="Inserisci immagine">
                    <ImageIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    title="Divisore"
                >
                    <Minus className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-4 bg-sand-200 mx-1" />

                <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Annulla">
                    <Undo className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Ripeti">
                    <Redo className="w-4 h-4" />
                </ToolbarButton>

                <div className="flex-1" />

                {/* AI Button */}
                <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-terracotta-50 text-terracotta-500 rounded-lg text-xs font-medium hover:bg-terracotta-100 transition-colors"
                    title="Assistente AI"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI
                </button>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} />
        </div>
    );
}
