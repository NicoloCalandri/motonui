import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../supabase/database.types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

import { DestinationBriefing } from '@/lib/types';
import { AI_MODELS } from '@/lib/ai/models';
import { toJson } from '@/lib/json';
import { untrustedBlock, withUntrustedRule } from '@/lib/ai/untrusted';


/**
 * Generates or retrieves a cached destination briefing for trip planning.
 * Cache TTL: 7 days (stored in Supabase destination_cache table).
 */
export async function getDestinationBriefing(
    destination: string,
    language: 'it' | 'en',
    supabase: SupabaseClient<Database>
): Promise<DestinationBriefing> {
    const cacheKey = `${destination.toLowerCase().trim()}_${language}`;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Check cache
    const { data: cached } = await supabase.from('destination_cache')
        .select('briefing, fetched_at')
        .eq('destination', cacheKey)
        .gte('fetched_at', sevenDaysAgo)
        .single();

    if (cached?.briefing) {
        return cached.briefing as unknown as DestinationBriefing;
    }

    // Generate fresh
    const briefing = await generateBriefing(destination, language);

    // Store in cache
    await supabase.from('destination_cache')
        .upsert({ 
            destination: cacheKey, 
            briefing: toJson(briefing), 
            fetched_at: new Date().toISOString() 
        });

    return briefing;
}

async function generateBriefing(destination: string, language: 'it' | 'en'): Promise<DestinationBriefing> {
    // T-5.3: the destination is user input, kept apart from the instructions.
    const data = untrustedBlock({ [language === 'it' ? 'Destinazione' : 'Destination']: destination }, 200);
    const prompt = language === 'it'
        ? `Crea un briefing di viaggio conciso per la destinazione indicata nei dati.
${data}
Rispondi SOLO con JSON valido con questi campi:
summary (2 frasi), bestTimeToVisit (1 frase), mustSee (array 3-5 posti),
localTips (array 3-4 consigli pratici), currencyTip (1 frase), languageTip (1 frase)`
        : `Create a concise travel briefing for the destination given in the data.
${data}
Reply ONLY with valid JSON with these fields:
summary (2 sentences), bestTimeToVisit (1 sentence), mustSee (array 3-5 places),
localTips (array 3-4 practical tips), currencyTip (1 sentence), languageTip (1 sentence)`;

    const message = await anthropic.messages.create({
        model: AI_MODELS.fast,
        max_tokens: 768,
        system: withUntrustedRule(
            language === 'it' ? 'Sei un assistente di viaggio esperto e conciso.' : 'You are a concise, expert travel assistant.',
            language,
        ),
        messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';

    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]) as DestinationBriefing;
    } catch { /* fallback */ }

    return {
        summary: `${destination} è una destinazione affascinante.`,
        bestTimeToVisit: 'Dipende dalla stagione.',
        mustSee: [],
        localTips: [],
        currencyTip: '',
        languageTip: '',
    };
}
