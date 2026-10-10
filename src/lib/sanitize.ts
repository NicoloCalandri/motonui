import type { JSONContent } from '@tiptap/react';
import type { TiptapDoc, TiptapNode } from '@/lib/types';

const MAX_DOC_DEPTH = 12;
const MAX_DOC_NODES = 1500;
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);
const SAFE_MARKS = new Set(['bold', 'italic', 'strike', 'code', 'link']);
const SAFE_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'horizontalRule',
  'hardBreak',
  'codeBlock',
  'image',
]);

// C0 controls except tab, newline and carriage return, plus DEL.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalizes user plain text before storage: trim, drop control characters,
 * cap the length. It does NOT HTML-escape (T-1.6): the value is stored as
 * typed and escaped where it is output (React, email templates via
 * escapeHtml), which avoids the double escaping seen in the UI and on mobile.
 */
export function sanitizePlainText(input: string, maxLength = 1000): string {
  return input.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sanitizeTiptapDocument(input: unknown): JSONContent {
  let nodeCount = 0;

  const visit = (node: unknown, depth: number): JSONContent | null => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return null;
    }

    if (depth > MAX_DOC_DEPTH) {
      throw new Error('Il contenuto del post è troppo annidato.');
    }

    nodeCount += 1;
    if (nodeCount > MAX_DOC_NODES) {
      throw new Error('Il contenuto del post è troppo grande.');
    }

    const raw = node as Record<string, unknown>;
    const type = typeof raw.type === 'string' ? raw.type : null;
    if (!type || !SAFE_NODE_TYPES.has(type)) {
      return null;
    }

    const sanitized: JSONContent = { type };

    if (typeof raw.text === 'string') {
      sanitized.text = raw.text.replace(CONTROL_CHARS, '');
    }

    if (raw.attrs && typeof raw.attrs === 'object' && !Array.isArray(raw.attrs)) {
      const attrs = raw.attrs as Record<string, unknown>;
      const nextAttrs: Record<string, unknown> = {};

      if (type === 'heading') {
        const level = Number(attrs.level);
        nextAttrs.level = Number.isInteger(level) && level >= 1 && level <= 3 ? level : 2;
      }

      if (type === 'image' && typeof attrs.src === 'string') {
        const safeSrc = sanitizeUrl(attrs.src);
        if (!safeSrc) return null;
        nextAttrs.src = safeSrc;
        if (typeof attrs.alt === 'string') nextAttrs.alt = sanitizePlainText(attrs.alt, 300);
        if (typeof attrs.title === 'string') nextAttrs.title = sanitizePlainText(attrs.title, 300);
      }

      if (Object.keys(nextAttrs).length > 0) {
        sanitized.attrs = nextAttrs;
      }
    }

    if (Array.isArray(raw.marks)) {
      const marks = raw.marks
        .map((mark) => {
          if (!mark || typeof mark !== 'object' || Array.isArray(mark)) return null;
          const rawMark = mark as Record<string, unknown>;
          const markType = typeof rawMark.type === 'string' ? rawMark.type : null;
          if (!markType || !SAFE_MARKS.has(markType)) return null;
          if (markType !== 'link') return { type: markType };
          const href = rawMark.attrs && typeof rawMark.attrs === 'object' && !Array.isArray(rawMark.attrs)
            ? sanitizeUrl(String((rawMark.attrs as Record<string, unknown>).href ?? ''))
            : null;
          if (!href) return null;
          return {
            type: 'link',
            attrs: {
              href,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
          };
        })
        .filter(Boolean) as JSONContent['marks'];

      if (marks && marks.length > 0) sanitized.marks = marks;
    }

    if (Array.isArray(raw.content)) {
      const content = raw.content
        .map((child) => visit(child, depth + 1))
        .filter(Boolean) as JSONContent[];
      if (content.length > 0) sanitized.content = content;
    }

    return sanitized;
  };

  const doc = visit(input, 0);
  if (!doc || doc.type !== 'doc') {
    throw new Error('Formato del contenuto del post non valido.');
  }

  return doc;
}

/**
 * Sanitized document, or null when the input is missing or not a valid
 * document. For places that must not throw, like loading a stored post into
 * the editor.
 */
export function safeTiptapDocument(input: unknown): TiptapDoc | null {
  try {
    const doc = sanitizeTiptapDocument(input);
    return { type: 'doc', content: (doc.content ?? []) as TiptapNode[] };
  } catch {
    return null;
  }
}
