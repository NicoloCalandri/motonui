// The /server entry renders without a browser DOM; the default one is picked by bundler conditions.
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import { STARTER_KIT_OPTIONS } from '@/lib/blog/editor-config';
import { sanitizeTiptapDocument } from '@/lib/sanitize';

export const UNAVAILABLE_CONTENT_HTML = '<p>Contenuto non disponibile.</p>';

/**
 * Turns a stored Tiptap document into HTML for the public blog (T-1.6).
 *
 * content_json is sanitized on write by the API, but trip members can also
 * write it directly through Supabase REST (RLS allows the author to update the
 * post), so it is sanitized again here, right before generateHTML, whose
 * output is injected with dangerouslySetInnerHTML.
 */
export function renderPostHtml(contentJson: unknown): string {
    if (!contentJson) return '';
    try {
        const doc = sanitizeTiptapDocument(contentJson);
        return generateHTML(doc, [StarterKit.configure(STARTER_KIT_OPTIONS), TiptapImage, TiptapLink]);
    } catch {
        return UNAVAILABLE_CONTENT_HTML;
    }
}
