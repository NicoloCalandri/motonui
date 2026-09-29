'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Quote, Link as LinkIcon, Image as ImageIcon, Heading1, Heading2, Minus, Undo, Redo, Sparkles, Loader2 } from 'lucide-react';
import type { TiptapDoc } from '@/lib/types';
import { readSseText } from '@/lib/ai/sse';
import { AiSuggestionPanel, ToolbarButton } from './editor-parts';

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
    const aiMenuRef = useRef<HTMLDivElement>(null);

    const [showAiMenu, setShowAiMenu] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

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

    // Close AI menu when clicking outside
    useEffect(() => {
        if (!showAiMenu) return;
        const handler = (e: MouseEvent) => {
            if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
                setShowAiMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAiMenu]);

    const handleAiCommand = useCallback(async (command: 'improve' | 'continue' | 'expand' | 'summarize') => {
        if (!editor) return;
        setShowAiMenu(false);
        setAiError(null);
        setAiSuggestion(null);
        setIsAiLoading(true);

        const { from, to, empty } = editor.state.selection;
        const selectedText = empty ? undefined : editor.state.doc.textBetween(from, to, '\n');
        const context = editor.getText({ blockSeparator: '\n' }).slice(0, 5000) || undefined;

        try {
            const res = await fetch('/api/ai/blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, selectedText, context, language: 'it' }),
            });

            if (!res.ok || !res.body) {
                const err = await res.json().catch(() => ({}));
                setAiError((err as { error?: string }).error ?? 'Errore AI');
                return;
            }

            const full = await readSseText(res.body, setAiSuggestion);

            if (!full) setAiError('Nessuna risposta dall\'AI');
        } catch {
            setAiError('Errore di connessione');
        } finally {
            setIsAiLoading(false);
        }
    }, [editor]);

    const acceptAiSuggestion = useCallback(() => {
        if (!editor || !aiSuggestion) return;
        editor.chain().focus()
            .setTextSelection(editor.state.doc.content.size)
            .insertContent([
                { type: 'horizontalRule' },
                { type: 'paragraph', content: [{ type: 'text', text: aiSuggestion }] },
            ])
            .run();
        setAiSuggestion(null);
    }, [editor, aiSuggestion]);

    if (!editor) return null;

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

                {/* AI Button + Dropdown */}
                <div className="relative" ref={aiMenuRef}>
                    <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => setShowAiMenu((v) => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-terracotta-50 text-terracotta-500 rounded-lg text-xs font-medium hover:bg-terracotta-100 transition-colors disabled:opacity-50"
                        title="Assistente AI"
                    >
                        {isAiLoading
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                        AI
                    </button>

                    {showAiMenu && !isAiLoading && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-sand-200 rounded-xl shadow-lg z-20 py-1 text-sm">
                            {([
                                { cmd: 'improve', label: '✨ Migliora il testo' },
                                { cmd: 'continue', label: '➕ Continua il testo' },
                                { cmd: 'expand', label: '🔍 Espandi i dettagli' },
                                { cmd: 'summarize', label: '📝 Riassumi' },
                            ] as const).map(({ cmd, label }) => (
                                <button
                                    key={cmd}
                                    type="button"
                                    onClick={() => handleAiCommand(cmd)}
                                    className="w-full text-left px-3 py-2 hover:bg-sand-50 text-ink-700"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* AI Suggestion Panel */}
            {(isAiLoading || aiSuggestion || aiError) && (
                <AiSuggestionPanel
                    loading={isAiLoading}
                    suggestion={aiSuggestion}
                    error={aiError}
                    onDismissError={() => setAiError(null)}
                    onAccept={acceptAiSuggestion}
                    onDiscard={() => setAiSuggestion(null)}
                />
            )}

            {/* Editor Content */}
            <EditorContent editor={editor} />
        </div>
    );
}
