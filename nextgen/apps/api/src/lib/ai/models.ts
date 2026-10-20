/**
 * Claude model ids used by the app (CLAUDE.md, "Regole per le chiamate AI").
 * Change them here only: every lib/ai module imports from this file.
 */
export const AI_MODELS = {
    /** Short tasks: categorization, captions, SEO, destination briefings, packing lists. */
    fast: 'claude-haiku-4-5',
    /** Long-form generation: blog writing assistant, full trip posts. */
    longForm: 'claude-sonnet-4-6',
} as const;
