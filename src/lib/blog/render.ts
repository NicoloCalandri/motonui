import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
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
        return generateHTML(doc, [StarterKit, TiptapImage, TiptapLink]);
    } catch {
        return UNAVAILABLE_CONTENT_HTML;
    }
}
