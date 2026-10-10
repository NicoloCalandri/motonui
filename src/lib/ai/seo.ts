import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_MODELS } from '@/lib/ai/models';
import { untrustedBlock, withUntrustedRule } from '@/lib/ai/untrusted';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

interface SEOInput {
    title: string;
    content: string; // plain text excerpt from blog post
    destination?: string;
}

interface SEOResult {
    seoTitle: string;
    seoDescription: string;
    ogDescription: string;
    suggestedSlug: string;
}

/**
 * The model's answer is checked before use (T-5.3): an injected instruction
 * that changes the shape or stuffs a field is rejected and the deterministic
 * fallback is used instead. Lengths have some slack over the prompt's limits.
 */
const SEOResultSchema = z.object({
    seoTitle: z.string().trim().min(1).max(80),
    seoDescription: z.string().trim().min(1).max(200),
    ogDescription: z.string().trim().min(1).max(260),
    suggestedSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
});

/**
 * Generates SEO metadata for a blog post using Claude Haiku.
 * Returns title, meta description, OG description, and URL slug.
 */
export async function generateSEOMetadata(input: SEOInput): Promise<SEOResult> {
    const { title, content, destination } = input;

    const message = await anthropic.messages.create({
        model: AI_MODELS.fast,
        max_tokens: 512,
        system: withUntrustedRule('You are an SEO assistant for a travel blog.', 'en'),
        messages: [{
            role: 'user',
            content: `Generate SEO metadata for the travel blog post given in the data.
Return ONLY valid JSON with these fields: seoTitle, seoDescription, ogDescription, suggestedSlug.

${untrustedBlock({ Title: title, Destination: destination ?? 'Unknown', 'Content excerpt': content.slice(0, 800) }, 1200)}

Rules:
- seoTitle: 50-60 chars, include destination
- seoDescription: 120-155 chars, compelling, include call-to-action
- ogDescription: 200 chars max, for social sharing
- suggestedSlug: lowercase, hyphens, no special chars`,
        }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';

    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = SEOResultSchema.safeParse(JSON.parse(jsonMatch[0]));
            if (parsed.success) return parsed.data;
        }
    } catch { /* fallback below */ }

    // Fallback
    const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80);

    return {
        seoTitle: title.slice(0, 60),
        seoDescription: content.slice(0, 150),
        ogDescription: content.slice(0, 200),
        suggestedSlug: slug,
    };
}

// ─── Keyword-based expense categorization ────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    food: [
        'ristorante', 'restaurant', 'bar', 'caffè', 'cafe', 'pranzo', 'lunch', 'cena', 'dinner',
        'colazione', 'breakfast', 'sushi', 'pizza', 'gelato', 'aperitivo', 'trattoria', 'market',
        'supermercato', 'supermarket', 'grocery', 'food', 'cibo', 'mangiare',
    ],
    transport: [
        'volo', 'flight', 'aereo', 'plane', 'treno', 'train', 'bus', 'autobus', 'taxi', 'uber',
        'metro', 'subway', 'ferry', 'traghetto', 'noleggio', 'rental', 'auto', 'car', 'benzina',
        'gas', 'fuel', 'ticket', 'biglietto', 'transfer', 'navetta',
    ],
    accommodation: [
        'hotel', 'albergo', 'hostel', 'ostello', 'airbnb', 'b&b', 'bed', 'camera', 'room',
        'notte', 'night', 'alloggio', 'affitto', 'appartamento', 'apartment', 'motel',
    ],
    activity: [
        'museo', 'museum', 'tour', 'visita', 'visit', 'ingresso', 'entry', 'biglietto', 'ticket',
        'escursione', 'excursion', 'trekking', 'hiking', 'snorkeling', 'diving', 'surf',
        'sport', 'spa', 'wellness', 'show', 'concerto', 'teatro', 'cinema',
    ],
    shopping: [
        'shopping', 'negozio', 'shop', 'souvenir', 'mercato', 'market', 'acquisto', 'purchase',
        'abbigliamento', 'clothes', 'vestiti', 'scarpe', 'shoes', 'farmacia', 'pharmacy',
    ],
};

/**
 * Categorizes an expense description using local keyword matching.
 * Falls back to 'other' if no match found.
 * This is the fast, zero-cost version — AI version is available in the API route.
 */
export function categorizeExpenseLocally(description: string): string {
    const lower = description.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => lower.includes(kw))) {
            return category;
        }
    }

    return 'other';
}

/**
 * Categorizes an expense description using Claude Haiku.
 * Returns a single category string.
 */
export async function categorizeExpenseAI(description: string): Promise<string> {
    const message = await anthropic.messages.create({
        model: AI_MODELS.fast,
        max_tokens: 16,
        system: withUntrustedRule('You classify travel expenses.', 'en'),
        messages: [{
            role: 'user',
            content: `Categorize the travel expense given in the data in one word.
Options: food, transport, accommodation, activity, shopping, other
${untrustedBlock({ Expense: description }, 300)}
Reply with only the category word.`,
        }],
    });

    const text = (message.content[0]?.type === 'text' ? message.content[0].text : '').trim().toLowerCase();
    const valid = ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'];
    return valid.includes(text) ? text : 'other';
}
