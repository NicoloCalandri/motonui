import Anthropic from '@anthropic-ai/sdk';
import type { TiptapDoc } from '@/lib/types';
import { AI_MODELS } from '@/lib/ai/models';
import { untrustedBlock, withUntrustedRule } from '@/lib/ai/untrusted';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

interface TripContext {
    title: string;
    destination: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    days?: {
        date: string;
        title?: string;
        legs?: { from: string; to: string; type: string }[];
    }[];
    expenses?: {
        total_eur: number;
        top_categories: string[];
        countries_visited: string[];
    };
}

/**
 * Generates a full blog post about a trip using Claude Sonnet.
 * Returns a Tiptap JSON document ready to be stored as content_json.
 */
export async function generateTripSummary(
    trip: TripContext,
    language: 'it' | 'en' = 'it'
): Promise<TiptapDoc> {
    const baseSystem = language === 'it'
        ? `Sei un blogger di viaggio di coppia. Scrivi post coinvolgenti, poetici e autentici.
       Quando descrivi un viaggio, vai oltre i fatti — racconti emozioni, odori, conversazioni notturne.
       Rispondi SOLO con JSON Tiptap valido (type: doc, content: [...])
       Usa: paragraph, heading (level 2/3), blockquote per momenti speciali.`
        : `You are a couples travel blogger. Write engaging, poetic, and authentic posts.
       When describing a trip, go beyond facts — tell emotions, smells, late-night conversations.
       Reply ONLY with valid Tiptap JSON (type: doc, content: [...])
       Use: paragraph, heading (level 2/3), blockquote for special moments.`;
    const system = withUntrustedRule(baseSystem, language);

    const itinerary = trip.days?.map((d) =>
        `${d.date} — ${d.title ?? 'Giorno'}: ${d.legs?.map((l) => `${l.from} → ${l.to} ${l.type}`).join(', ') ?? 'no legs'}`
    ) ?? [];

    // T-5.3: every trip field is user input and goes in the untrusted block.
    const it = language === 'it';
    const data = untrustedBlock({
        [it ? 'Titolo' : 'Title']: trip.title,
        [it ? 'Destinazione' : 'Destination']: trip.destination,
        [it ? 'Periodo' : 'Dates']: `${trip.startDate ?? '?'} – ${trip.endDate ?? '?'}`,
        [it ? 'Note' : 'Notes']: trip.description,
        [it ? 'Itinerario' : 'Itinerary']: itinerary,
        [it ? 'Spese totali (EUR)' : 'Total spent (EUR)']: trip.expenses?.total_eur,
        [it ? 'Paesi' : 'Countries']: trip.expenses?.countries_visited,
    }, 8000);

    const userPrompt = it
        ? `Scrivi un post di blog di viaggio completo (600-900 parole) sul viaggio descritto nei dati.
${data}
Inizia con un titolo H2 evocativo. Poi scrivi il post in prima persona plurale.`
        : `Write a complete travel blog post (600-900 words) about the trip described in the data.
${data}
Start with an evocative H2 title. Write in first person plural.`;

    const message = await anthropic.messages.create({
        model: AI_MODELS.longForm,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';

    try {
        // Claude should return valid Tiptap JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as TiptapDoc;
        }
    } catch {
        // Fallback: wrap plain text in Tiptap doc
    }

    // Fallback Tiptap doc
    return {
        type: 'doc',
        content: text
            .split('\n\n')
            .filter(Boolean)
            .map((para) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: para }],
            })),
    };
}
