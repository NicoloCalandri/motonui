import type { StarterKitOptions } from '@tiptap/starter-kit';

/**
 * StarterKit options shared by the post editor and the public renderer.
 *
 * Tiptap 3's StarterKit bundles extensions that Tiptap 2 did not:
 * - `link`: configured separately in both places, so it is not registered twice;
 * - `underline`: the sanitizer does not allow the mark (src/lib/sanitize.ts),
 *   it would be typed with Ctrl+U and silently dropped on save;
 * - `trailingNode`: would append an empty paragraph to posts that end with an
 *   image, a heading or a code block.
 */
export const STARTER_KIT_OPTIONS: Partial<StarterKitOptions> = {
    link: false,
    underline: false,
    trailingNode: false,
};
