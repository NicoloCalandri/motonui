import Anthropic from '@anthropic-ai/sdk';
import type { TriptapDoc } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// ─── System Prompts ───────────────────────────────────────────────────────────

const BLOG_SYSTEM_IT = `Sei un assistente AI per la scrittura di blog di viaggio di coppia.
Aiuti a scrivere contenuti autentici, poetici e coinvolgenti.
Scivi in prima persona plurale (noi/nostro) con un tono caldo e personale.
Evita i cliché del turismo. Focalizzati sulle emozioni, i dettagli inaspettati e l'esperienza condivisa.
Quando continui o migliori un testo esistente, mantieni il tono e lo stile dell'autore.`;

const BLOG_SYSTEM_EN = `You are an AI assistant for couples travel blog writing.
You help write authentic, poetic, and engaging content.
Write in first person plural (we/our) with a warm, personal tone.  
Avoid tourist clichés. Focus on emotions, unexpected details, and shared experiences.
When continuing or improving existing text, maintain the author's tone and style.`;

// ─── Streaming Blog Assistant ─────────────────────────────────────────────────

interface AssistBlogInput {
    command: 'continue' | 'improve' | 'summarize' | 'expand';
    selectedText?: string;
    context?: string;
    language: 'it' | 'en';
}

/**
 * Streams a blog writing AI response for the Tiptap editor.
 * Returns a ReadableStream for Server-Sent Events.
 */
export function streamBlogAssistant(input: AssistBlogInput): ReadableStream {
    const { command, selectedText, context, language } = input;

    const system = language === 'it' ? BLOG_SYSTEM_IT : BLOG_SYSTEM_EN;

    const COMMANDS = {
        continue: language === 'it'
            ? `Continua il seguente testo di viaggio in modo naturale (2-3 paragrafi):\n\n${selectedText ?? context}`
            : `Continue the following travel text naturally (2-3 paragraphs):\n\n${selectedText ?? context}`,
        improve: language === 'it'
            ? `Migliora questo testo rendendolo più vivido e coinvolgente, mantenendo il significato originale:\n\n${selectedText}`
            : `Improve this text to make it more vivid and engaging while keeping the original meaning:\n\n${selectedText}`,
        summarize: language === 'it'
            ? `Riassumi questo testo in 2-3 frasi evocative:\n\n${selectedText ?? context}`
            : `Summarize this text in 2-3 evocative sentences:\n\n${selectedText ?? context}`,
        expand: language === 'it'
            ? `Espandi questo testo aggiungendo dettagli sensoriali e riflessioni personali:\n\n${selectedText}`
            : `Expand this text by adding sensory details and personal reflections:\n\n${selectedText}`,
    };

    const userPrompt = COMMANDS[command];

    return new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            try {
                const stream = anthropic.messages.stream({
                    model: 'claude-sonnet-4-5',
                    max_tokens: 1024,
                    system,
                    messages: [{ role: 'user', content: userPrompt }],
                });

                for await (const event of stream) {
                    if (
                        event.type === 'content_block_delta' &&
                        event.delta.type === 'text_delta'
                    ) {
                        const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
                        controller.enqueue(encoder.encode(data));
                    }
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            } catch (err) {
                console.error('[motonui][blog-assistant] Stream error:', err);
                controller.error(err);
            }
        },
    });
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const DAILY_LIMITS = {
    haiku: 200,
    sonnet: 50,
    opus: 10,
};

/**
 * Checks and increments AI usage for a user. Returns false if limit exceeded.
 * Uses Supabase ai_usage table with daily reset.
 */
export async function checkRateLimit(
    userId: string,
    model: keyof typeof DAILY_LIMITS,
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);

    const { data: usage } = await supabase
        .from('ai_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('model', model)
        .eq('date', today)
        .single();

    const currentCount = (usage?.count as number) ?? 0;
    if (currentCount >= DAILY_LIMITS[model]) return false;

    // Upsert usage
    await supabase.from('ai_usage').upsert(
        { user_id: userId, model, date: today, count: currentCount + 1 },
        { onConflict: 'user_id,model,date' }
    );

    return true;
}
