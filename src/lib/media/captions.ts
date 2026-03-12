import Anthropic from '@anthropic-ai/sdk';
import type { InstagramType } from '@/lib/types';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

interface GenerateCaptionInput {
    captions: string[];
    type: InstagramType;
    language: 'it' | 'en';
}

interface CaptionResult {
    caption: string;
    hashtags: string[];
}

const TYPE_PROMPTS: Record<InstagramType, string> = {
    carousel: 'un carousel Instagram di più foto',
    story: 'una Instagram Story singola',
    reel: 'un Instagram Reel',
};

/**
 * Generates an Instagram caption + hashtag set for a photo export using Claude.
 * Uses claude-haiku-3-5 for cost efficiency on short text generation.
 */
export async function generateCaption(input: GenerateCaptionInput): Promise<CaptionResult> {
    const { captions, type, language } = input;

    const captionContext = captions.length > 0
        ? `Le foto hanno queste descrizioni: ${captions.join(' | ')}`
        : 'Nessuna descrizione disponibile per le foto.';

    const systemPrompt = language === 'it'
        ? `Sei un esperto copywriter per Instagram specializzato in contenuti di viaggio di coppia. 
       Scrivi caption coinvolgenti, autentiche e poetiche. Usa emoji con parsimonia (massimo 3-5).
       Rispondi SOLO con JSON valido nel formato: {"caption": "...", "hashtags": ["...", "..."]}`
        : `You are an expert Instagram copywriter specialized in couples travel content. 
       Write engaging, authentic, and poetic captions. Use emojis sparingly (max 3-5).
       Reply ONLY with valid JSON in format: {"caption": "...", "hashtags": ["...", "..."]}`;

    const userPrompt = language === 'it'
        ? `Scrivi una caption Instagram per ${TYPE_PROMPTS[type]} di viaggio di coppia.
       ${captionContext}
       Includi 10-15 hashtag rilevanti in italiano e inglese.`
        : `Write an Instagram caption for ${type} travel content from a couple's trip.
       ${captionContext}
       Include 10-15 relevant hashtags in English.`;

    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';

    try {
        const parsed = JSON.parse(text) as { caption: string; hashtags: string[] };
        return {
            caption: parsed.caption ?? '',
            hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        };
    } catch {
        // Fallback: return raw text as caption
        return {
            caption: text.trim(),
            hashtags: [],
        };
    }
}
