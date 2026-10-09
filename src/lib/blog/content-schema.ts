import { z } from 'zod';
import type { JSONContent } from '@tiptap/react';
import { sanitizeTiptapDocument } from '@/lib/sanitize';

/**
 * Zod schema for a post's `content_json`: the value that reaches the handler
 * is the sanitized document, never the one received. An invalid document is
 * a validation error (400). `null` clears the content.
 */
export const postContentSchema = z.unknown().transform((value, ctx): JSONContent | null => {
    if (value === null || value === undefined) return null;
    try {
        return sanitizeTiptapDocument(value);
    } catch (error) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error instanceof Error ? error.message : 'Formato del contenuto del post non valido.',
        });
        return z.NEVER;
    }
});
