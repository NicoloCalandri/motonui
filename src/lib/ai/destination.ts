import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../supabase/database.types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

import { DestinationBriefing } from '@/lib/types';


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
    const { data: cached } = await (supabase.from('destination_cache') as any)
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
    await (supabase.from('destination_cache') as any)
        .upsert({ 
            destination: cacheKey, 
            briefing: briefing as any, 
            fetched_at: new Date().toISOString() 
        });

    return briefing;
}

async function generateBriefing(destination: string, language: 'it' | 'en'): Promise<DestinationBriefing> {
    const prompt = language === 'it'
        ? `Crea un briefing di viaggio conciso per: ${destination}
       Rispondi SOLO con JSON valido con questi campi:
       summary (2 frasi), bestTimeToVisit (1 frase), mustSee (array 3-5 posti), 
       localTips (array 3-4 consigli pratici), currencyTip (1 frase), languageTip (1 frase)`
        : `Create a concise travel briefing for: ${destination}
       Reply ONLY with valid JSON with these fields:
       summary (2 sentences), bestTimeToVisit (1 sentence), mustSee (array 3-5 places),
       localTips (array 3-4 practical tips), currencyTip (1 sentence), languageTip (1 sentence)`;

    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 768,
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
